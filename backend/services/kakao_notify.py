"""
3rd Vibe — 카카오 알림톡 + SMS 통합 알림 서비스
================================================
Solapi를 통해 카카오 알림톡(우선) / SMS(폴백)을 발송합니다.

사용 전 준비사항:
  1. 카카오톡 채널 개설 → 채널 검색용 아이디 확인
  2. center-pf.kakao.com 에서 알림톡 템플릿 4개 심사 제출 및 승인
  3. Solapi 대시보드(solapi.com)에서 카카오 채널 연동
  4. 아래 TEMPLATE_CODES 에 승인된 템플릿 코드 입력
  5. .env 에 KAKAO_CHANNEL_ID, KAKAO_CHANNEL_URL 입력
"""

from __future__ import annotations

import hashlib
import hmac
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx

# ── 환경변수 ───────────────────────────────────────────────
SOLAPI_API_KEY    = os.getenv("SOLAPI_API_KEY", "")
SOLAPI_API_SECRET = os.getenv("SOLAPI_API_SECRET", "")
SENDER_PHONE      = os.getenv("SENDER_PHONE", "")       # 발신번호 (Solapi 등록)
KAKAO_PF_ID       = os.getenv("KAKAO_PF_ID", "")        # 카카오 채널 pfId (Solapi에서 확인)
KAKAO_CHANNEL_URL = os.getenv("KAKAO_CHANNEL_URL", "")  # 예: http://pf.kakao.com/_xxxxx/chat

SOLAPI_API_BASE = "https://api.solapi.com"

# ── 알림톡 템플릿 코드 ─────────────────────────────────────
# center-pf.kakao.com 심사 승인 후 발급받은 코드를 입력하세요
TEMPLATE_CODES = {
    "join":    os.getenv("KKT_TPL_JOIN",    ""),   # 회원가입 완료
    "payment": os.getenv("KKT_TPL_PAYMENT", ""),   # 결제 완료
    "match":   os.getenv("KKT_TPL_MATCH",   ""),   # 매칭 성사
    "meeting": os.getenv("KKT_TPL_MEETING", ""),   # 만남 일정 안내
}

# ── 알림톡 템플릿 본문 (심사 제출용 초안) ─────────────────
# 카카오 심사 시 이 본문 그대로 제출하세요.
# #{변수} 형식으로 치환됩니다.
TEMPLATE_BODIES = {
    "join": """\
안녕하세요, #{name}님! 🎉
3rd Vibe에 가입을 환영합니다.

서류 인증을 완료하시면 매칭이 시작됩니다.
아래 버튼을 눌러 서류 인증을 진행해 주세요.

문의사항은 카카오톡 채널을 통해 연락 주세요.\
""",
    "payment": """\
#{name}님, 결제가 완료되었습니다. 💳

· 매칭비: 15,000원 (매칭 큐레이션 비용 · 소멸)
· 약속 보증금: 15,000원 (본인 귀책사유 없으면 환불)
· 합계: 30,000원

※ 보증금은 본인의 귀책사유(노쇼·일방취소 등)가 없을 경우 환불됩니다.

매칭 큐레이션을 시작합니다.
보통 3~5 영업일 내 첫 매칭을 안내드릴게요!

문의사항은 카카오톡 채널을 통해 연락 주세요.\
""",
    "match": """\
#{name}님, 새로운 인연이 연결되었습니다! 💑

3rd Vibe 매니저가 일정 조율을 도와드릴게요.
앱에서 상대방 프로필을 확인해 보세요.

문의사항은 카카오톡 채널을 통해 연락 주세요.\
""",
    "meeting": """\
#{name}님, 내일 만남 일정이 있어요! 📅

· 일시: #{date}
· 장소: #{place}

설레는 만남이 되길 바랍니다 ✨
변경/취소는 카카오톡 채널로 연락 주세요.\
""",
}


def _normalize_phone(phone: str) -> str:
    """010-xxxx-xxxx → 01xxxxxxxxxx"""
    return phone.replace("-", "").replace(" ", "")


def _solapi_auth_header() -> str:
    """Solapi HMAC-SHA256 인증 헤더 생성"""
    date_str  = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
    salt      = uuid.uuid4().hex
    signature = hmac.new(
        SOLAPI_API_SECRET.encode(),
        f"{date_str}{salt}".encode(),
        hashlib.sha256,
    ).hexdigest()
    return f"HMAC-SHA256 apiKey={SOLAPI_API_KEY}, date={date_str}, salt={salt}, signature={signature}"


async def _send_alimtalk(to: str, template_key: str, variables: dict) -> bool:
    """알림톡 발송 (템플릿 코드가 없으면 SMS 폴백)"""
    template_id = TEMPLATE_CODES.get(template_key, "")
    to_norm     = _normalize_phone(to)

    if not SOLAPI_API_KEY or not SOLAPI_API_SECRET or not to_norm:
        return False

    # 알림톡 사용 가능한 경우
    if KAKAO_PF_ID and template_id:
        # 변수 치환으로 본문 생성
        body = TEMPLATE_BODIES[template_key]
        for k, v in variables.items():
            body = body.replace(f"#{{{k}}}", str(v))

        payload = {
            "message": {
                "to":   to_norm,
                "from": _normalize_phone(SENDER_PHONE),
                "kakaoOptions": {
                    "pfId":       KAKAO_PF_ID,
                    "templateId": template_id,
                    "variables":  {f"#{{{k}}}": str(v) for k, v in variables.items()},
                    # 채널 채팅 버튼 (심사 때 버튼도 함께 등록해야 함)
                    "buttons": [
                        {
                            "buttonType": "WL",
                            "buttonName": "채널 문의하기",
                            "linkMo":     KAKAO_CHANNEL_URL,
                            "linkPc":     KAKAO_CHANNEL_URL,
                        }
                    ],
                },
            }
        }
    else:
        # SMS 폴백 (템플릿 미승인 상태)
        body = TEMPLATE_BODIES[template_key]
        for k, v in variables.items():
            body = body.replace(f"#{{{k}}}", str(v))
        payload = {
            "message": {
                "to":   to_norm,
                "from": _normalize_phone(SENDER_PHONE),
                "text": body,
            }
        }

    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{SOLAPI_API_BASE}/messages/v4/send",
                json=payload,
                headers={"Authorization": _solapi_auth_header()},
                timeout=5,
            )
            return r.status_code == 200
    except Exception:
        return False


# ── 공개 함수 ───────────────────────────────────────────────

async def notify_join(phone: str, name: str) -> bool:
    """회원가입 완료 알림톡"""
    return await _send_alimtalk(phone, "join", {"name": name})


async def notify_payment(phone: str, name: str) -> bool:
    """결제 완료 알림톡"""
    return await _send_alimtalk(phone, "payment", {"name": name})


async def notify_match(phone: str, name: str) -> bool:
    """매칭 성사 알림톡"""
    return await _send_alimtalk(phone, "match", {"name": name})


async def notify_meeting(phone: str, name: str, date: str, place: str) -> bool:
    """만남 일정 안내 알림톡 (전날 발송)"""
    return await _send_alimtalk(
        phone, "meeting",
        {"name": name, "date": date, "place": place},
    )
