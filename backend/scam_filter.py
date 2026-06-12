"""
RealBridge — 실시간 스캠 필터 & 어드민 API
==============================================

아키텍처 설계
-------------

1. 메시지 필터링 파이프라인 (레이어드 방어)
   ┌─────────────────────────────────────────────────────────┐
   │  Layer 1. 정규화 (Normalize)                            │
   │    - 유니코드 풀위드 → 반위드 변환 (Ａ→A)               │
   │    - 구두점·공백·특수문자 제거 (L.I.N.E → LINE)        │
   │    - 동음이의 치환 (ㅋㅏㅋㅏㅇㅗ → 카카오)             │
   │                                                         │
   │  Layer 2. 패턴 매칭 (Regex + 가중치)                   │
   │    - 카테고리별 금지 패턴 (외부앱/투자/개인정보 등)     │
   │    - 패턴당 심각도 점수 (1~10)                          │
   │                                                         │
   │  Layer 3. 컨텍스트 분석                                 │
   │    - 같은 방에서 반복 패턴 (짧은 시간 내 3회 → 가중치↑)│
   │    - 링크 URL 패턴 감지                                 │
   │                                                         │
   │  Layer 4. 판정                                          │
   │    - BLOCK  (심각도 합 ≥ 8): 메시지 차단 + 경고        │
   │    - WARN   (심각도 합 4~7): 경고 첨부 후 전송          │
   │    - PASS   (심각도 합 < 4): 정상 전송                  │
   └─────────────────────────────────────────────────────────┘

2. 위반 누적 파이프라인
   BLOCK 1~2회 → warning 기록
   BLOCK 3회   → account.status = 'pending' + 어드민 알림
   신고 접수   → pending 즉시 전환 + 어드민 알림

3. DB 스키마
   scam_logs(id, user_id, room_id, original_text, matched_patterns,
             severity_score, action, created_at)
   admin_alerts(id, user_id, reason, status, created_at, resolved_at)
   account_status: 'active' | 'pending' | 'suspended' | 'banned'
"""

import logging
import re
import time
import unicodedata
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field as PydanticField

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin"])
security = HTTPBearer()

# ── 판정 결과 ─────────────────────────────────────────────────
class FilterAction(str, Enum):
    PASS  = "pass"
    WARN  = "warn"
    BLOCK = "block"

BLOCK_THRESHOLD = 8
WARN_THRESHOLD  = 4
AUTO_PENDING_VIOLATIONS = 3   # 이 횟수 이상 BLOCK → pending


# ── 스캠 패턴 정의 ────────────────────────────────────────────
# (패턴명, 정규식, 심각도 1~10, 카테고리)
@dataclass
class ScamPattern:
    name:       str
    regex:      re.Pattern
    severity:   int          # 1~10
    category:   str
    tip:        str          # 운영팀 참고 메모


def _build(pattern: str, flags: int = re.IGNORECASE) -> re.Pattern:
    return re.compile(pattern, flags)


SCAM_PATTERNS: list[ScamPattern] = [

    # ── 외부 메신저 유도 (심각도 8~9) ──────────────────────
    ScamPattern("KakaoTalk",
        _build(r"카\s*카\s*오|k\s*a\s*k\s*a\s*o|카톡|카.톡|ㅋㅏㅋㅏㅇㅗ"),
        severity=9, category="external_app",
        tip="카카오톡 ID 유도 시도"),

    ScamPattern("LINE",
        _build(r"l[\s.\-_]*i[\s.\-_]*n[\s.\-_]*e|라\s*인|ら\s*い\s*ん"),
        severity=9, category="external_app",
        tip="LINE ID 유도 시도"),

    ScamPattern("WhatsApp",
        _build(r"w[\s.\-_]*h[\s.\-_]*a[\s.\-_]*t[\s.\-_]*s[\s.\-_]*a[\s.\-_]*p\s*p|왓\s*츠\s*앱"),
        severity=9, category="external_app",
        tip="WhatsApp 유도"),

    ScamPattern("Telegram",
        _build(r"t[\s.\-_]*e[\s.\-_]*l[\s.\-_]*e[\s.\-_]*g[\s.\-_]*r[\s.\-_]*a[\s.\-_]*m|텔\s*레\s*그\s*램"),
        severity=9, category="external_app",
        tip="Telegram 유도"),

    ScamPattern("WeChat",
        _build(r"w[\s.\-_]*e[\s.\-_]*c[\s.\-_]*h[\s.\-_]*a[\s.\-_]*t|위\s*챗|微\s*信"),
        severity=9, category="external_app",
        tip="WeChat 유도"),

    ScamPattern("Instagram_DM",
        _build(r"인\s*스\s*타\s*(그\s*램)?\s*(d\s*m|디\s*엠|아\s*이\s*디)|insta\s*gram\s*(dm|id)"),
        severity=8, category="external_app",
        tip="Instagram DM 유도"),

    # ── 투자/암호화폐 스캠 (심각도 9~10) ───────────────────
    ScamPattern("CryptoScam",
        _build(r"코\s*인|비\s*트\s*코\s*인|이\s*더\s*리\s*움|암\s*호\s*화\s*폐"
               r"|c\s*r\s*y\s*p\s*t\s*o|b\s*i\s*t\s*c\s*o\s*i\s*n"
               r"|仮想通貨|虛擬貨幣|加密貨幣"),
        severity=10, category="investment_scam",
        tip="암호화폐 언급 — 투자 스캠 고위험"),

    ScamPattern("InvestmentScam",
        _build(r"투\s*자\s*(수\s*익|기\s*회|추\s*천|보\s*장|원\s*금)"
               r"|수\s*익\s*률|고\s*수\s*익|원\s*금\s*보\s*장"
               r"|投\s*資|投\s*資\s*機\s*会"),
        severity=10, category="investment_scam",
        tip="투자 수익 보장 — 로맨스 스캠 패턴"),

    ScamPattern("FXScam",
        _build(r"f\s*x\s*(트\s*레\s*이\s*딩|거\s*래|투\s*자)"
               r"|외\s*환\s*거\s*래|선\s*물\s*거\s*래"),
        severity=9, category="investment_scam",
        tip="FX/선물 투자 유도"),

    # ── 개인정보 수집 (심각도 6~8) ─────────────────────────
    ScamPattern("PhoneNumber",
        _build(r"(?<!\d)(0[1-9][0-9][\s\-‐–]{0,2}\d{3,4}[\s\-‐–]{0,2}\d{4})(?!\d)"),
        severity=7, category="personal_info",
        tip="전화번호 직접 공유 시도"),

    ScamPattern("BankAccount",
        _build(r"계\s*좌\s*(번\s*호|이\s*체|송\s*금)|통\s*장\s*번\s*호"
               r"|口\s*座\s*番\s*号|帳\s*號"),
        severity=9, category="personal_info",
        tip="계좌번호 요청 — 금전 사기 고위험"),

    ScamPattern("AddressRequest",
        _build(r"주\s*소\s*(알\s*려|보\s*내\s*줘|가\s*르\s*쳐)|집\s*주\s*소"
               r"|住\s*所|住\s*址"),
        severity=6, category="personal_info",
        tip="실제 주소 수집 시도"),

    # ── 악성 링크 (심각도 7~10) ────────────────────────────
    ScamPattern("SuspiciousURL",
        _build(r"https?://(?!realbridge\.app)[^\s]{5,}"
               r"|bit\.ly/|tinyurl\.com/|t\.co/"),
        severity=8, category="malicious_link",
        tip="외부 링크 — 피싱 사이트 가능성"),

    ScamPattern("APKLink",
        _build(r"\.apk|앱\s*설치\s*(링\s*크|주\s*소)|다\s*운\s*로\s*드\s*(해|받아)"),
        severity=10, category="malicious_link",
        tip="APK 설치 유도 — 악성앱 고위험"),

    # ── 기프트카드/현금 요청 (심각도 9) ────────────────────
    ScamPattern("GiftCardScam",
        _build(r"기\s*프\s*트\s*카\s*드|구\s*글\s*플\s*레\s*이\s*(카\s*드|상\s*품\s*권)"
               r"|아\s*이\s*튠\s*즈|iTunes|Google\s*Play\s*(card|gift)"),
        severity=9, category="gift_card",
        tip="기프트카드 요청 — 스캠 정형 패턴"),

    ScamPattern("MoneyTransfer",
        _build(r"송\s*금\s*(해\s*줘|부\s*탁|요\s*청)|돈\s*(보\s*내|빌\s*려)"
               r"|振\s*込|送\s*金\s*して"),
        severity=10, category="money_request",
        tip="금전 송금 직접 요청"),
]


# ── 인메모리 DB ───────────────────────────────────────────────
_scam_logs:     list[dict] = []
_admin_alerts:  list[dict] = []
_users_db: dict[str, dict] = {
    "user_abc123": {"name": "민준",   "nationality": "KR", "status": "active",    "report_count": 0, "violation_count": 0, "tier": "basic",    "created_at": "2024-01-15"},
    "user_yuki":   {"name": "Yuki",   "nationality": "JP", "status": "active",    "report_count": 1, "violation_count": 2, "tier": "truenote", "created_at": "2024-02-10"},
    "user_scam1":  {"name": "???",    "nationality": "TW", "status": "pending",   "report_count": 3, "violation_count": 3, "tier": "basic",    "created_at": "2024-03-01"},
    "user_banned": {"name": "차단됨", "nationality": "KR", "status": "banned",    "report_count": 5, "violation_count": 7, "tier": "basic",    "created_at": "2023-12-01"},
}


# ── 텍스트 정규화 (우회 대응 핵심) ──────────────────────────

def normalize(text: str) -> str:
    """
    공격자의 우회 기법을 무력화하는 다단계 정규화.

    우회 패턴 예시 → 정규화 결과:
      "L.I.N.E"    → "LINE"
      "카 .톡"     → "카톡"
      "Ｋａｋａｏ" → "Kakao"   (전각→반각)
      "к4к40"     → "k4k40"   (키릴 유사 문자)
      "ℒℐℕℰ"     → "LINE"    (유니코드 레터 표현)
    """
    # 1. 유니코드 NFKC 정규화 (전각 → 반각, 리거처 분해 등)
    normalized = unicodedata.normalize("NFKC", text)

    # 2. 제로 폭 문자 제거
    normalized = re.sub(r"[​‌‍⁠﻿]", "", normalized)

    # 3. 단어 내 삽입된 점·슬래시·대시·언더스코어 제거 (L.I.N.E → LINE)
    normalized = re.sub(r"(?<=[a-zA-Zㄱ-ㅎㅏ-ㅣ가-힣])[.\-_/\\|](?=[a-zA-Zㄱ-ㅎㅏ-ㅣ가-힣])",
                        "", normalized)

    # 4. 연속 공백 → 단일 공백
    normalized = re.sub(r"\s+", " ", normalized)

    # 5. 키릴 유사 문자 → 라틴 치환 (обход: о→o, а→a, е→e, с→c 등)
    CYRILLIC_MAP = str.maketrans("аАbBcCdDeEgGHiIjJkKlLmMnNoOpPqQrRsStTuUvVwWxXyYzZ"
                                  "оОрРуУхХ",
                                  "aAbBcCdDeEgGHiIjJkKlLmMnNoOpPqQrRsStTuUvVwWxXyYzZ"
                                  "oOpPuUxX")
    normalized = normalized.translate(CYRILLIC_MAP)

    return normalized.strip()


# ── 필터링 엔진 ───────────────────────────────────────────────

@dataclass
class FilterResult:
    action:          FilterAction
    severity_score:  int
    matched:         list[dict]   = field(default_factory=list)
    block_reason:    Optional[str] = None


def analyze_message(text: str, user_id: str, room_id: str) -> FilterResult:
    """
    메시지를 정규화 → 패턴 매칭 → 판정.
    반환값으로 차단/경고/통과 여부와 매칭된 패턴 목록을 제공.
    """
    normalized = normalize(text)
    total_severity = 0
    matched = []

    for pat in SCAM_PATTERNS:
        m = pat.regex.search(normalized)
        if m:
            matched.append({
                "pattern":  pat.name,
                "category": pat.category,
                "severity": pat.severity,
                "matched":  m.group(0),
                "tip":      pat.tip,
            })
            total_severity += pat.severity

    # 판정
    if total_severity >= BLOCK_THRESHOLD:
        action = FilterAction.BLOCK
        reason = matched[0]["tip"] if matched else "복합 스캠 패턴"
    elif total_severity >= WARN_THRESHOLD:
        action = FilterAction.WARN
        reason = None
    else:
        action = FilterAction.PASS
        reason = None

    # 로그 저장
    if matched:
        _scam_logs.append({
            "id":              str(uuid.uuid4()),
            "user_id":         user_id,
            "room_id":         room_id,
            "original_text":   text[:200],   # 저장은 앞 200자만
            "normalized_text": normalized[:200],
            "matched_patterns": matched,
            "severity_score":  total_severity,
            "action":          action.value,
            "created_at":      datetime.now(timezone.utc).isoformat(),
        })

    # BLOCK 시 위반 누적 + 자동 Pending 처리
    if action == FilterAction.BLOCK:
        _accumulate_violation(user_id, matched)

    return FilterResult(
        action=action,
        severity_score=total_severity,
        matched=matched,
        block_reason=reason,
    )


def _accumulate_violation(user_id: str, matched_patterns: list[dict]):
    """
    BLOCK 판정 시 해당 유저의 위반 횟수를 증가.
    AUTO_PENDING_VIOLATIONS 이상이면 계정 pending + 어드민 알림.
    """
    user = _users_db.get(user_id)
    if not user:
        return

    user["violation_count"] = user.get("violation_count", 0) + 1
    count = user["violation_count"]

    if count >= AUTO_PENDING_VIOLATIONS and user["status"] == "active":
        user["status"] = "pending"
        alert_id = str(uuid.uuid4())
        _admin_alerts.append({
            "id":         alert_id,
            "user_id":    user_id,
            "reason":     f"자동 Pending: 스캠 패턴 {count}회 적발 — {matched_patterns[0]['pattern']}",
            "status":     "unresolved",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "resolved_at": None,
        })
        logger.warning("자동 Pending 처리: user=%s violations=%d", user_id, count)


# ── REST 엔드포인트 (어드민 전용) ──────────────────────────────
# 실제 서비스: 어드민 JWT 역할(role=admin) 검증 미들웨어 추가 필요

class AdminActionRequest(BaseModel):
    user_id:     str
    reason:      Optional[str] = None

class AdminActionResponse(BaseModel):
    success:     bool
    user_id:     str
    new_status:  str
    message:     str

class ScamLogEntry(BaseModel):
    id:              str
    user_id:         str
    room_id:         str
    original_text:   str
    matched_patterns: list[dict]
    severity_score:  int
    action:          str
    created_at:      str

class UserSummary(BaseModel):
    user_id:         str
    name:            str
    nationality:     str
    status:          str
    tier:            str
    report_count:    int
    violation_count: int
    created_at:      str


@router.get("/users", response_model=list[UserSummary])
async def list_users(
    status_filter: Optional[str] = None,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """유저 목록 (status 필터 가능: pending/banned/active)."""
    users = []
    for uid, u in _users_db.items():
        if status_filter and u["status"] != status_filter:
            continue
        users.append(UserSummary(
            user_id=uid, name=u["name"], nationality=u["nationality"],
            status=u["status"], tier=u["tier"],
            report_count=u.get("report_count", 0),
            violation_count=u.get("violation_count", 0),
            created_at=u.get("created_at", ""),
        ))
    # 위험도 높은 순 정렬
    users.sort(key=lambda x: (x.violation_count + x.report_count * 2), reverse=True)
    return users


@router.get("/scam-logs", response_model=list[ScamLogEntry])
async def get_scam_logs(
    limit: int = 50,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """최신 스캠 감지 로그 조회."""
    return [ScamLogEntry(**log) for log in reversed(_scam_logs[-limit:])]


@router.get("/alerts")
async def get_admin_alerts(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """미해결 어드민 알림 조회."""
    return [a for a in _admin_alerts if a["status"] == "unresolved"]


@router.post("/warn", response_model=AdminActionResponse)
async def send_warning(
    body: AdminActionRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """유저에게 공식 경고 발송."""
    user = _users_db.get(body.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")

    user["report_count"] = user.get("report_count", 0) + 1
    logger.info("관리자 경고 발송: user=%s reason=%s", body.user_id, body.reason)

    return AdminActionResponse(
        success=True, user_id=body.user_id,
        new_status=user["status"],
        message=f"경고가 발송되었습니다. (누적 {user['report_count']}회)",
    )


@router.post("/ban", response_model=AdminActionResponse)
async def ban_user(
    body: AdminActionRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """유저 영구 정지."""
    user = _users_db.get(body.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")
    if user["status"] == "banned":
        raise HTTPException(status_code=409, detail="이미 영구 정지된 유저입니다.")

    user["status"] = "banned"
    # 알림 해결 처리
    for alert in _admin_alerts:
        if alert["user_id"] == body.user_id:
            alert["status"] = "resolved"
            alert["resolved_at"] = datetime.now(timezone.utc).isoformat()

    logger.warning("유저 영구 정지: user=%s reason=%s", body.user_id, body.reason)
    return AdminActionResponse(
        success=True, user_id=body.user_id,
        new_status="banned",
        message="계정이 영구 정지되었습니다.",
    )


@router.post("/restore", response_model=AdminActionResponse)
async def restore_user(
    body: AdminActionRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Pending 계정을 active로 복구 (오탐 해소)."""
    user = _users_db.get(body.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")

    user["status"] = "active"
    for alert in _admin_alerts:
        if alert["user_id"] == body.user_id:
            alert["status"] = "resolved"
            alert["resolved_at"] = datetime.now(timezone.utc).isoformat()

    return AdminActionResponse(
        success=True, user_id=body.user_id,
        new_status="active",
        message="계정이 복구되었습니다.",
    )


# ── WebSocket 채팅과의 통합 헬퍼 (chat_ws.py에서 호출) ────────

def filter_chat_message(text: str, user_id: str, room_id: str) -> FilterResult:
    """
    chat_ws.py의 메시지 수신 루프에서 호출.
    반환된 FilterResult.action 에 따라:
      PASS  → 번역 후 전송
      WARN  → 경고 첨부 후 전송
      BLOCK → 전송 차단, 발신자에게 경고 메시지 반환
    """
    return analyze_message(text, user_id, room_id)
