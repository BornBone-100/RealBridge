"""
RealBridge — 매칭 Pacing & Safety 시스템
=========================================

아키텍처 설계
-------------

1. 좋아요 Rate Limiting (Redis 기반 일일 카운터)
   ┌──────────────────────────────────────────────────────┐
   │  Key:  like_quota:{user_id}:{YYYY-MM-DD}             │
   │  Value: 사용한 횟수 (INCR)                           │
   │  TTL:  당일 자정까지 (초 단위)                       │
   │                                                      │
   │  BASIC    : 5회/일                                   │
   │  TRUENOTE : 15회/일  (프리미엄)                      │
   │  STAFF    : 무제한                                   │
   └──────────────────────────────────────────────────────┘
   Redis 없는 환경은 인메모리 dict로 fallback (개발용)

2. 차단(Block) 파이프라인
   ① blocks 테이블에 (blocker_id, blocked_id) INSERT
   ② matches 테이블 → status='blocked' UPDATE
   ③ messages 테이블 → is_visible=False UPDATE  (소프트 블라인드)
   ④ 실시간: 차단된 유저의 WebSocket에 'force_disconnect' 이벤트 전송

3. 신고(Report) 파이프라인
   ① reports 테이블 INSERT (사유 코드, 보충 설명)
   ② 차단 파이프라인 동시 실행 (신고 = 자동 차단)
   ③ 누적 신고 3회 → 자동 계정 임시 정지 (review_queue 진입)
   ④ 운영팀 알림 (Slack webhook 등)

DB 스키마:
  blocks(id, blocker_id, blocked_id, created_at)
  reports(id, reporter_id, reported_id, reason_code, description, created_at)
  review_queue(id, user_id, report_count, status, created_at)
"""

import asyncio
import logging
import os
from datetime import datetime, timezone, timedelta
from enum import Enum
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/safety", tags=["safety"])
security = HTTPBearer()

# ── 환경 설정 ─────────────────────────────────────────────────
REDIS_URL = os.getenv("REDIS_URL", "")  # 없으면 인메모리 fallback

# 등급별 일일 좋아요 한도
LIKE_QUOTA: dict[str, int] = {
    "basic":    5,
    "truenote": 15,
    "staff":    9999,
}

# 누적 신고 → 자동 임시 정지 기준
AUTO_SUSPEND_THRESHOLD = 3


# ── Redis / 인메모리 스토리지 추상화 ─────────────────────────

class _InMemoryQuota:
    """Redis 없는 환경용 인메모리 카운터 (개발/테스트 전용)."""
    def __init__(self):
        self._data: dict[str, int] = {}

    def _key(self, user_id: str) -> str:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        return f"like_quota:{user_id}:{today}"

    def get(self, user_id: str) -> int:
        return self._data.get(self._key(user_id), 0)

    def incr(self, user_id: str) -> int:
        key = self._key(user_id)
        self._data[key] = self._data.get(key, 0) + 1
        return self._data[key]

    def decr(self, user_id: str):
        """좋아요 취소 시 차감 (매칭 해제 포함)."""
        key = self._key(user_id)
        if key in self._data and self._data[key] > 0:
            self._data[key] -= 1


try:
    import redis.asyncio as aioredis
    _redis_client = aioredis.from_url(REDIS_URL) if REDIS_URL else None
except ImportError:
    _redis_client = None

_mem_quota = _InMemoryQuota()


async def _quota_get(user_id: str) -> int:
    if _redis_client:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        val = await _redis_client.get(f"like_quota:{user_id}:{today}")
        return int(val) if val else 0
    return _mem_quota.get(user_id)


async def _quota_incr(user_id: str) -> int:
    if _redis_client:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        key = f"like_quota:{user_id}:{today}"
        # TTL: 오늘 자정까지 남은 초
        now = datetime.now(timezone.utc)
        midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        ttl = int((midnight - now).total_seconds())

        pipe = _redis_client.pipeline()
        pipe.incr(key)
        pipe.expire(key, ttl)
        results = await pipe.execute()
        return int(results[0])
    return _mem_quota.incr(user_id)


async def _quota_decr(user_id: str):
    if _redis_client:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        key = f"like_quota:{user_id}:{today}"
        await _redis_client.decr(key)
    else:
        _mem_quota.decr(user_id)


# ── 인메모리 DB (실제: PostgreSQL) ───────────────────────────
_users_db: dict[str, dict] = {
    "user_abc123": {"tier": "basic",    "is_suspended": False},
    "user_yuki":   {"tier": "truenote", "is_suspended": False},
    "user_arya":   {"tier": "truenote", "is_suspended": False},
}
_blocks_db:  list[dict] = []
_reports_db: list[dict] = []
_review_queue: dict[str, dict] = {}
_matches_db: dict[str, dict] = {}   # match_id → match info


# ── Pydantic 모델 ─────────────────────────────────────────────

class ReportReason(str, Enum):
    SPAM          = "spam"            # 스팸/광고
    FAKE_PROFILE  = "fake_profile"    # 가짜 프로필
    HARASSMENT    = "harassment"      # 괴롭힘/욕설
    INAPPROPRIATE = "inappropriate"   # 부적절한 콘텐츠
    SCAM          = "scam"            # 사기/피싱
    OTHER         = "other"           # 기타

REPORT_REASON_LABELS: dict[ReportReason, str] = {
    ReportReason.SPAM:          "스팸 / 광고성 메시지",
    ReportReason.FAKE_PROFILE:  "가짜 프로필 / 사진 도용",
    ReportReason.HARASSMENT:    "욕설 / 괴롭힘",
    ReportReason.INAPPROPRIATE: "부적절한 콘텐츠",
    ReportReason.SCAM:          "사기 / 피싱 시도",
    ReportReason.OTHER:         "기타",
}


class LikeRequest(BaseModel):
    target_user_id: str


class LikeResponse(BaseModel):
    success:        bool
    used:           int          # 오늘 사용한 좋아요 수
    remaining:      int          # 남은 좋아요 수
    daily_limit:    int
    matched:        bool = False
    match_id:       Optional[str] = None
    reset_at:       str          # 다음 자정 ISO8601


class QuotaStatusResponse(BaseModel):
    user_id:     str
    tier:        str
    used:        int
    remaining:   int
    daily_limit: int
    reset_at:    str


class BlockRequest(BaseModel):
    target_user_id: str
    match_id:       Optional[str] = None   # 매칭 ID (있으면 매칭도 해제)


class BlockResponse(BaseModel):
    success:          bool
    blocked_user_id:  str
    match_dissolved:  bool
    message:          str


class ReportRequest(BaseModel):
    target_user_id: str
    reason:         ReportReason
    description:    Optional[str] = Field(None, max_length=500)
    match_id:       Optional[str] = None


class ReportResponse(BaseModel):
    success:          bool
    report_id:        str
    blocked:          bool        # 신고와 동시에 차단됨
    message:          str


# ── 유틸 함수 ─────────────────────────────────────────────────

def _next_midnight_iso() -> str:
    now = datetime.now(timezone.utc)
    midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return midnight.isoformat()


def _get_user(user_id: str) -> dict:
    user = _users_db.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")
    if user.get("is_suspended"):
        raise HTTPException(status_code=403, detail="계정이 임시 정지 상태입니다. 운영팀에 문의해 주세요.")
    return user


def _is_blocked(user_a: str, user_b: str) -> bool:
    return any(
        (b["blocker_id"] == user_a and b["blocked_id"] == user_b) or
        (b["blocker_id"] == user_b and b["blocked_id"] == user_a)
        for b in _blocks_db
    )


async def _do_block(blocker_id: str, blocked_id: str, match_id: Optional[str]) -> bool:
    """
    차단 파이프라인:
    1. blocks 테이블 INSERT
    2. 매칭 status 업데이트 (있을 경우)
    3. 메시지 블라인드 (소프트 삭제)
    4. 실시간 WebSocket 연결 종료 (실제: ConnectionManager 통해 처리)
    """
    # 이미 차단된 경우 스킵
    if _is_blocked(blocker_id, blocked_id):
        return False

    _blocks_db.append({
        "blocker_id": blocker_id,
        "blocked_id": blocked_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    match_dissolved = False
    if match_id and match_id in _matches_db:
        _matches_db[match_id]["status"] = "blocked"
        _matches_db[match_id]["is_visible"] = False
        match_dissolved = True

    logger.info("차단 처리: blocker=%s blocked=%s match=%s", blocker_id, blocked_id, match_id)
    return match_dissolved


async def _check_auto_suspend(reported_id: str):
    """
    특정 유저에 대한 누적 신고가 AUTO_SUSPEND_THRESHOLD 이상이면 자동 임시 정지.
    실제 서비스: 운영팀 Slack 알림 + 수동 검토 후 복구 플로우 포함.
    """
    report_count = sum(1 for r in _reports_db if r["reported_id"] == reported_id)

    if report_count >= AUTO_SUSPEND_THRESHOLD:
        if reported_id in _users_db:
            _users_db[reported_id]["is_suspended"] = True
            _review_queue[reported_id] = {
                "user_id":      reported_id,
                "report_count": report_count,
                "status":       "pending_review",
                "created_at":   datetime.now(timezone.utc).isoformat(),
            }
            logger.warning(
                "자동 임시 정지: user=%s report_count=%d", reported_id, report_count
            )


# ── 엔드포인트 ────────────────────────────────────────────────

@router.get("/quota/{user_id}", response_model=QuotaStatusResponse)
async def get_quota_status(
    user_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """오늘 남은 좋아요 횟수 조회."""
    user  = _get_user(user_id)
    tier  = user.get("tier", "basic")
    limit = LIKE_QUOTA.get(tier, LIKE_QUOTA["basic"])
    used  = await _quota_get(user_id)
    used  = min(used, limit)

    return QuotaStatusResponse(
        user_id=user_id,
        tier=tier,
        used=used,
        remaining=max(0, limit - used),
        daily_limit=limit,
        reset_at=_next_midnight_iso(),
    )


@router.post("/like", response_model=LikeResponse)
async def send_like(
    body:        LikeRequest,
    user_id:     str = "user_abc123",   # 실제: JWT에서 추출
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    좋아요 전송.
    - 일일 한도 초과 시 429
    - 차단 관계 시 403
    - 한도 내이면 카운터 INCR + 매칭 여부 확인
    """
    user  = _get_user(user_id)
    tier  = user.get("tier", "basic")
    limit = LIKE_QUOTA.get(tier, LIKE_QUOTA["basic"])
    used  = await _quota_get(user_id)

    if used >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "message":   f"오늘의 좋아요 {limit}회를 모두 사용했습니다.",
                "reset_at":  _next_midnight_iso(),
                "daily_limit": limit,
                "tier":      tier,
            },
        )

    if _is_blocked(user_id, body.target_user_id):
        raise HTTPException(status_code=403, detail="차단된 유저에게 좋아요를 보낼 수 없습니다.")

    new_used = await _quota_incr(user_id)
    new_used = min(new_used, limit)

    # TODO: 실제 매칭 로직 — 상대방도 좋아요를 보낸 경우 매칭 생성
    matched  = False
    match_id = None

    logger.info("좋아요: from=%s to=%s used=%d/%d", user_id, body.target_user_id, new_used, limit)
    return LikeResponse(
        success=True,
        used=new_used,
        remaining=max(0, limit - new_used),
        daily_limit=limit,
        matched=matched,
        match_id=match_id,
        reset_at=_next_midnight_iso(),
    )


@router.post("/block", response_model=BlockResponse)
async def block_user(
    body:        BlockRequest,
    user_id:     str = "user_abc123",
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    차단:
    - 즉시 상호 매칭 해제
    - 메시지 블라인드 처리
    - 상대방 피드에서 내 프로필 제거 (쿼리 레벨 필터)
    """
    _get_user(user_id)

    dissolved = await _do_block(user_id, body.target_user_id, body.match_id)

    return BlockResponse(
        success=True,
        blocked_user_id=body.target_user_id,
        match_dissolved=dissolved,
        message="차단되었습니다. 해당 유저는 더 이상 회원님을 볼 수 없습니다.",
    )


@router.post("/report", response_model=ReportResponse)
async def report_user(
    body:        ReportRequest,
    user_id:     str = "user_abc123",
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    신고:
    - 신고와 동시에 자동 차단
    - 누적 3회 → 자동 임시 정지
    - reports 테이블에 영구 기록 (익명 처리 후 운영팀 검토)
    """
    _get_user(user_id)

    # 중복 신고 방지 (같은 사유)
    already = any(
        r["reporter_id"] == user_id and
        r["reported_id"] == body.target_user_id and
        r["reason"]      == body.reason
        for r in _reports_db
    )
    if already:
        raise HTTPException(status_code=409, detail="이미 같은 사유로 신고한 유저입니다.")

    import uuid
    report_id = str(uuid.uuid4())
    _reports_db.append({
        "id":          report_id,
        "reporter_id": user_id,
        "reported_id": body.target_user_id,
        "reason":      body.reason,
        "description": body.description,
        "created_at":  datetime.now(timezone.utc).isoformat(),
    })

    # 신고 = 자동 차단
    await _do_block(user_id, body.target_user_id, body.match_id)

    # 누적 신고 임계값 체크 → 자동 정지
    await _check_auto_suspend(body.target_user_id)

    logger.info(
        "신고: reporter=%s reported=%s reason=%s",
        user_id, body.target_user_id, body.reason
    )
    return ReportResponse(
        success=True,
        report_id=report_id,
        blocked=True,
        message="신고가 접수되었습니다. 검토 후 조치가 취해집니다.",
    )


@router.get("/report/reasons")
async def get_report_reasons():
    """신고 사유 목록 조회 (프론트엔드 폼용)."""
    return [
        {"code": r.value, "label": REPORT_REASON_LABELS[r]}
        for r in ReportReason
    ]
