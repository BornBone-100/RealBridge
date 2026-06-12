"""
RealBridge — WebSocket 실시간 번역 채팅
=========================================

아키텍처 설계
-------------
클라이언트 A (KR)                      클라이언트 B (JP)
     │  WS /ws/chat/{room_id}                │
     │──────────────────────────────────────▶│
     │                                        │
     │   1. 텍스트 전송 (JSON)                │
     │──────────────▶ [ChatRoom]              │
     │                     │                  │
     │               2. 번역 요청             │
     │                     │─▶ DeepL API      │
     │                     │◀─ 번역문 (JA)    │
     │                     │                  │
     │               3. 브로드캐스트          │
     │                     │────────────────▶ │
     │                 {                       │
     │                   type: "message",      │
     │                   original: "안녕",     │
     │                   original_lang: "KO",  │
     │                   translated: "こんにちは",│
     │                   translated_lang: "JA",│
     │                   sender_id: "...",     │
     │                   is_mine: false        │
     │                 }                       │

특이 사항:
- 번역은 수신자 언어 기준으로만 수행 (발신자는 원문 그대로)
- 같은 언어끼리는 번역 스킵 (KR→KR)
- DeepL 장애 시 원문만 전달 (graceful degradation)
- 연결 수 제한: 방당 2명 (데이팅 앱 특성)
- Ping/Pong 하트비트로 무응답 연결 감지
"""

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import httpx
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(tags=["chat-ws"])

# ── 환경 변수 ─────────────────────────────────────────────────
DEEPL_API_KEY  = os.getenv("DEEPL_API_KEY", "")
DEEPL_ENDPOINT = "https://api-free.deepl.com/v2/translate"  # 유료: api.deepl.com
TRANSLATE_TIMEOUT_S = float(os.getenv("TRANSLATE_TIMEOUT_S", "3.0"))
MAX_CONNECTIONS_PER_ROOM = 2   # 1:1 채팅


# ── 국가코드 → DeepL 언어코드 매핑 ───────────────────────────
class Nationality(str, Enum):
    KR = "KR"
    JP = "JP"
    TW = "TW"

NATIONALITY_TO_LANG: dict[Nationality, str] = {
    Nationality.KR: "KO",
    Nationality.JP: "JA",
    Nationality.TW: "ZH",   # DeepL: ZH = 번체/간체 공통 (TW는 ZH로 처리)
}

LANG_LABELS: dict[str, str] = {
    "KO": "한국어", "JA": "日本語", "ZH": "中文",
}


# ── Pydantic 메시지 모델 ──────────────────────────────────────
class IncomingMessage(BaseModel):
    """클라이언트 → 서버 메시지 포맷."""
    type:    str   = "message"   # "message" | "ping" | "typing"
    text:    str   = ""
    temp_id: str   = ""          # 클라이언트 낙관적 업데이트용 임시 ID


class OutgoingMessage(BaseModel):
    """서버 → 클라이언트 메시지 포맷."""
    type:             str         # "message" | "pong" | "typing" | "error" | "system"
    message_id:       Optional[str] = None
    temp_id:          Optional[str] = None    # 낙관적 업데이트 확인용
    sender_id:        Optional[str] = None
    original:         Optional[str] = None   # 원문
    original_lang:    Optional[str] = None   # 원문 언어 코드
    translated:       Optional[str] = None   # 번역문 (수신자 언어)
    translated_lang:  Optional[str] = None   # 번역 언어 코드
    is_mine:          bool = False
    timestamp:        Optional[str] = None
    # 은어/감지 경고
    slang_warning:    Optional[str] = None


# ── 연결 세션 ────────────────────────────────────────────────
@dataclass
class ChatSession:
    user_id:     str
    nationality: Nationality
    websocket:   WebSocket
    connected_at: float = field(default_factory=time.time)
    last_pong:   float  = field(default_factory=time.time)


# ── 채팅 방 관리자 ────────────────────────────────────────────
class ChatRoom:
    """
    한 방에 최대 2개 세션을 관리.
    메시지 수신 → 번역 → 브로드캐스트 파이프라인 담당.
    """
    def __init__(self, room_id: str):
        self.room_id  = room_id
        self.sessions: dict[str, ChatSession] = {}   # user_id → session
        self._msg_counter = 0

    def is_full(self) -> bool:
        return len(self.sessions) >= MAX_CONNECTIONS_PER_ROOM

    def add(self, session: ChatSession):
        self.sessions[session.user_id] = session

    def remove(self, user_id: str):
        self.sessions.pop(user_id, None)

    def other(self, user_id: str) -> Optional[ChatSession]:
        """상대방 세션 반환."""
        for uid, s in self.sessions.items():
            if uid != user_id:
                return s
        return None

    def next_msg_id(self) -> str:
        self._msg_counter += 1
        return f"{self.room_id}_{self._msg_counter}"

    async def broadcast_to(
        self,
        target_session: ChatSession,
        payload: OutgoingMessage,
    ):
        """특정 세션에게 메시지 전송. 연결 끊어진 경우 무시."""
        try:
            await target_session.websocket.send_text(payload.model_dump_json())
        except Exception as e:
            logger.warning("전송 실패 user=%s err=%s", target_session.user_id, e)


# ── 전역 방 레지스트리 ────────────────────────────────────────
_rooms: dict[str, ChatRoom] = {}

def get_or_create_room(room_id: str) -> ChatRoom:
    if room_id not in _rooms:
        _rooms[room_id] = ChatRoom(room_id)
    return _rooms[room_id]


# ── DeepL 번역 파이프라인 ─────────────────────────────────────

async def translate_text(
    text: str,
    source_lang: str,
    target_lang: str,
) -> tuple[str, str | None]:
    """
    DeepL API로 번역 수행.

    Returns
    -------
    (translated_text, warning_message | None)

    warning_message: 은어/비속어 감지 경고 (휴리스틱 기반)
    장애 시 원문 그대로 반환 (graceful degradation).
    """
    # 같은 언어면 번역 스킵
    if source_lang == target_lang:
        return text, None

    if not DEEPL_API_KEY:
        # 개발 환경: API 키 없으면 Mock 번역
        logger.debug("DeepL API 키 없음 — Mock 번역 반환")
        mock = _mock_translate(text, target_lang)
        return mock, None

    warning = _detect_slang_warning(text, source_lang)

    try:
        async with httpx.AsyncClient(timeout=TRANSLATE_TIMEOUT_S) as client:
            resp = await client.post(
                DEEPL_ENDPOINT,
                data={
                    "auth_key": DEEPL_API_KEY,
                    "text":        text,
                    "source_lang": source_lang,
                    "target_lang": target_lang,
                    # 존댓말 보존: 데이팅 앱에서 반말 번역 방지
                    "formality":   "more" if target_lang == "JA" else "default",
                },
            )
            resp.raise_for_status()
            result = resp.json()
            translated = result["translations"][0]["text"]
            return translated, warning

    except httpx.TimeoutException:
        logger.warning("DeepL 타임아웃 — 원문 반환")
        return text, "번역 서버 응답이 지연되어 원문을 표시합니다."
    except Exception as e:
        logger.error("DeepL 오류: %s", e)
        return text, None


def _detect_slang_warning(text: str, source_lang: str) -> str | None:
    """
    은어/비속어 휴리스틱 감지.
    실제 서비스: ML 모델 또는 금칙어 DB 사용 권장.

    경고 메시지는 수신자에게 노출하여 오해 방지.
    """
    # 한국어 은어 패턴 예시
    KO_SLANG = ["ㅋㅋ", "ㅎㅎ", "ㅠㅠ", "ㄷㄷ", "헐", "개", "존"]
    # 일본어 은어 예시
    JA_SLANG = ["草", "w", "ｗ", "ﾜﾛｽ"]

    patterns = KO_SLANG if source_lang == "KO" else JA_SLANG if source_lang == "JA" else []
    for p in patterns:
        if p in text:
            return f"이 메시지에 한국/일본 특유의 표현이 포함되어 번역이 부정확할 수 있어요."
    return None


def _mock_translate(text: str, target_lang: str) -> str:
    """개발용 Mock 번역 (API 키 없는 환경)."""
    prefixes = {"KO": "[KO번역] ", "JA": "[JA翻訳] ", "ZH": "[ZH翻譯] "}
    return prefixes.get(target_lang, "[번역] ") + text


# ── Ping/Pong 하트비트 ────────────────────────────────────────
async def heartbeat(session: ChatSession, room: ChatRoom, interval: int = 25):
    """
    25초마다 Ping 전송.
    50초 이상 Pong 없으면 연결 종료.
    """
    while session.user_id in room.sessions:
        await asyncio.sleep(interval)
        try:
            await session.websocket.send_text(
                json.dumps({"type": "ping", "ts": int(time.time())})
            )
        except Exception:
            break


# ── WebSocket 엔드포인트 ──────────────────────────────────────

@router.websocket("/ws/chat/{room_id}")
async def websocket_chat(
    websocket:   WebSocket,
    room_id:     str,
    user_id:     str   = Query(...),
    nationality: str   = Query(...),   # "KR" | "JP" | "TW"
):
    """
    WebSocket 채팅 엔드포인트.

    Query 파라미터:
        user_id:     인증된 유저 ID
        nationality: 유저 국가코드 (KR/JP/TW)

    메시지 포맷 (클라이언트 → 서버):
        {"type": "message", "text": "안녕하세요", "temp_id": "abc123"}
        {"type": "ping"}
        {"type": "typing"}     ← 타이핑 중 표시
    """
    # 국가코드 검증
    try:
        nat = Nationality(nationality.upper())
    except ValueError:
        await websocket.close(code=4001, reason="Invalid nationality code")
        return

    room = get_or_create_room(room_id)

    # 방 정원 초과 검사
    if room.is_full() and user_id not in room.sessions:
        await websocket.close(code=4002, reason="Room is full")
        return

    await websocket.accept()

    session = ChatSession(user_id=user_id, nationality=nat, websocket=websocket)
    room.add(session)

    # 입장 알림
    other = room.other(user_id)
    if other:
        join_msg = OutgoingMessage(
            type="system",
            original=f"{user_id}님이 입장했습니다.",
        )
        await room.broadcast_to(other, join_msg)

    # 하트비트 태스크 시작
    asyncio.create_task(heartbeat(session, room))

    logger.info("WS 연결: room=%s user=%s nat=%s", room_id, user_id, nationality)

    try:
        while True:
            raw = await websocket.receive_text()

            # JSON 파싱
            try:
                data = IncomingMessage.model_validate_json(raw)
            except Exception:
                err = OutgoingMessage(type="error", original="잘못된 메시지 형식입니다.")
                await room.broadcast_to(session, err)
                continue

            # ── Ping 처리 ──────────────────────────────
            if data.type == "ping":
                session.last_pong = time.time()
                pong = OutgoingMessage(type="pong")
                await room.broadcast_to(session, pong)
                continue

            # ── 타이핑 중 ──────────────────────────────
            if data.type == "typing":
                other = room.other(user_id)
                if other:
                    typing_msg = OutgoingMessage(type="typing", sender_id=user_id)
                    await room.broadcast_to(other, typing_msg)
                continue

            # ── 일반 메시지 ────────────────────────────
            if data.type == "message" and data.text.strip():

                # ── 스캠 필터 (Layer 1~4) ──────────────
                from scam_filter import filter_chat_message, FilterAction
                filter_result = filter_chat_message(data.text, user_id, room_id)

                if filter_result.action == FilterAction.BLOCK:
                    block_msg = OutgoingMessage(
                        type="error",
                        original=f"메시지가 차단되었습니다: {filter_result.block_reason}. "
                                  f"외부 연락처·투자 유도·악성 링크는 허용되지 않습니다.",
                        temp_id=data.temp_id or None,
                    )
                    await room.broadcast_to(session, block_msg)
                    continue
                # WARN은 통과 후 slang_warning 필드에 패턴 이름 첨부
                warn_note = (f"⚠️ 민감한 표현이 포함되어 있어요: "
                             f"{filter_result.matched[0]['pattern']}"
                             if filter_result.action == FilterAction.WARN else None)

                msg_id    = room.next_msg_id()
                timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                source_lang = NATIONALITY_TO_LANG[nat]
                other = room.other(user_id)

                # 발신자에게: 원문 그대로 (is_mine=True)
                sender_payload = OutgoingMessage(
                    type="message",
                    message_id=msg_id,
                    temp_id=data.temp_id or None,
                    sender_id=user_id,
                    original=data.text,
                    original_lang=source_lang,
                    translated=None,          # 본인은 번역 불필요
                    translated_lang=None,
                    is_mine=True,
                    timestamp=timestamp,
                )
                await room.broadcast_to(session, sender_payload)

                # 수신자에게: 번역문 포함
                if other:
                    target_lang = NATIONALITY_TO_LANG[other.nationality]
                    translated, slang_warning = await translate_text(
                        data.text, source_lang, target_lang
                    )
                    receiver_payload = OutgoingMessage(
                        type="message",
                        message_id=msg_id,
                        sender_id=user_id,
                        original=data.text,
                        original_lang=source_lang,
                        translated=translated if translated != data.text else None,
                        translated_lang=target_lang if translated != data.text else None,
                        is_mine=False,
                        timestamp=timestamp,
                        slang_warning=slang_warning,
                    )
                    await room.broadcast_to(other, receiver_payload)

    except WebSocketDisconnect:
        logger.info("WS 연결 종료: room=%s user=%s", room_id, user_id)
    finally:
        room.remove(user_id)
        # 상대방에게 퇴장 알림
        other = room.other(user_id)
        if other:
            leave_msg = OutgoingMessage(
                type="system",
                original=f"상대방이 연결을 종료했습니다.",
            )
            await room.broadcast_to(other, leave_msg)
        # 빈 방 정리
        if not room.sessions:
            _rooms.pop(room_id, None)
