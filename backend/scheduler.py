"""
3rd Vibe — 데이트 다음날 피드백 스케줄러
==========================================
APScheduler + FastAPI lifespan 통합.

동작:
  매일 오전 9시 → 전날 confirmed_datetime이 지난 date_milestones 조회
               → 양쪽 유저에게 feedback_surveys 레코드 생성
               → Solapi로 피드백 요청 SMS 발송

  피드백 응답 후:
    한쪽이라도 want_next_date=False 이면
    → match.state = 'stopped_no_fault'
    → payment refund-deposit 자동 호출
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from database import get_admin_db_direct  # 동기 클라이언트 직접 획득 함수

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone="Asia/Seoul")

SOLAPI_API_KEY    = os.getenv("SOLAPI_API_KEY", "")
SOLAPI_API_SECRET = os.getenv("SOLAPI_API_SECRET", "")
SENDER_PHONE      = os.getenv("SENDER_PHONE", "")
INTERNAL_API      = os.getenv("INTERNAL_API_URL", "http://localhost:8000")


def _norm(phone: str) -> str:
    """010-xxxx-xxxx → 01xxxxxxxxxx (Solapi 형식)"""
    return phone.replace("-", "").replace(" ", "")


# ── Solapi SMS ────────────────────────────────────────────
async def send_sms(to: str, text: str) -> bool:
    if not SOLAPI_API_KEY or not SOLAPI_API_SECRET or not SENDER_PHONE or not to:
        logger.warning("Solapi 미설정 또는 수신번호 없음")
        return False

    import hashlib, hmac, time
    ts   = str(int(time.time() * 1000))
    salt = os.urandom(8).hex()
    sig  = hmac.new(
        SOLAPI_API_SECRET.encode(),
        f"{ts}{salt}".encode(),
        hashlib.sha256,
    ).hexdigest()
    auth = f"HMAC-SHA256 apiKey={SOLAPI_API_KEY}, date={ts}, salt={salt}, signature={sig}"

    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.post(
                "https://api.solapi.com/messages/v4/send",
                headers={"Authorization": auth},
                json={"message": {"to": _norm(to), "from": _norm(SENDER_PHONE), "text": text}},
            )
            return r.status_code == 200
    except Exception as e:
        logger.error(f"SMS 발송 실패: {e}")
        return False


# ── 핵심 작업: 매일 오전 9시 실행 ────────────────────────
async def send_day_after_feedback():
    """
    전날 완료된 (또는 완료 예정이었던) 마일스톤에 대해
    피드백 서베이를 생성하고 SMS를 발송한다.
    """
    db = get_admin_db_direct()

    yesterday_end   = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    yesterday_start = yesterday_end - timedelta(days=1)

    # 1. 어제 날짜로 confirmed된 마일스톤 조회 (feedback 미발송)
    milestones_res = db.table("date_milestones").select(
        "*, matches(user_a_id, user_b_id, state)"
    ).gte(
        "confirmed_datetime", yesterday_start.isoformat()
    ).lt(
        "confirmed_datetime", yesterday_end.isoformat()
    ).eq("status", "confirmed").is_("feedback_sent_at", "null").execute()

    if not milestones_res.data:
        logger.info("어제 완료 마일스톤 없음 — 피드백 발송 스킵")
        return

    for ms in milestones_res.data:
        match    = ms.get("matches", {})
        user_a   = match.get("user_a_id")
        user_b   = match.get("user_b_id")
        match_state = match.get("state")

        if match_state in ("stopped_no_fault", "stopped_fault", "cancelled"):
            continue  # 이미 중단된 매칭 스킵

        now = datetime.now(timezone.utc).isoformat()

        # 2. feedback_surveys 레코드 생성 (양쪽)
        for uid in [user_a, user_b]:
            if not uid:
                continue
            # 중복 방지
            dup = db.table("feedback_surveys").select("id").eq(
                "milestone_id", ms["id"]
            ).eq("user_id", uid).execute()
            if dup.data:
                continue

            db.table("feedback_surveys").insert({
                "milestone_id": ms["id"],
                "user_id":      uid,
                "sent_at":      now,
            }).execute()

            # 유저 전화번호 조회 후 SMS 발송
            user_res = db.table("users").select("name, phone").eq(
                "id", uid
            ).execute()
            if not user_res.data:
                continue

            user  = user_res.data[0]
            phone = user.get("phone", "")
            name  = user.get("name", "고객")

            ms_no = ms["milestone_no"]
            sms_text = (
                f"[3rd Vibe] {name}님, {ms_no}차 만남은 어떠셨나요? 😊\n"
                f"앱에서 호감도와 다음 만남 의향을 알려주시면\n"
                f"더 정확한 매칭을 도와드립니다.\n"
                f"👉 3rd Vibe 앱 → 피드백 응답하기"
            )
            await send_sms(phone, sms_text)

        # 3. feedback_sent_at 업데이트
        db.table("date_milestones").update({
            "feedback_sent_at": now
        }).eq("id", ms["id"]).execute()

        logger.info(f"[Scheduler] 마일스톤 {ms['id']} 피드백 발송 완료")


# ── 피드백 응답 처리 (라우터에서 호출) ───────────────────
async def process_feedback_response(
    milestone_id: str,
    user_id: str,
    want_next_date: bool,
    db,
) -> dict:
    """
    유저가 피드백 서베이에 응답했을 때 호출.
    want_next_date=False 이면 매칭 중단 + 환불 트리거.
    """
    # 마일스톤 조회
    ms_res = db.table("date_milestones").select(
        "*, matches(id, user_a_id, user_b_id, state)"
    ).eq("id", milestone_id).single().execute()

    if not ms_res.data:
        return {"error": "마일스톤을 찾을 수 없습니다."}

    ms    = ms_res.data
    match = ms.get("matches", {})

    if not want_next_date and match.get("state") == "active":
        match_id = match["id"]

        # 매칭 중단 처리
        db.table("matches").update({
            "state":      "stopped_no_fault",
            "stopped_by": user_id,
            "closed_at":  datetime.now(timezone.utc).isoformat(),
            "stop_reason": "유저 요청 — 다음 만남 의향 없음",
        }).eq("id", match_id).execute()

        # 양쪽 유저 보증금 환불 트리거
        for uid in [match["user_a_id"], match["user_b_id"]]:
            async with httpx.AsyncClient(timeout=10) as c:
                await c.post(
                    f"{INTERNAL_API}/api/payment/refund-deposit",
                    json={"user_id": uid, "reason": "유저 요청 — 다음 만남 의향 없음"},
                )

        return {"stopped": True, "refund_triggered": True}

    return {"stopped": False}


# ── 스케줄러 시작/종료 ────────────────────────────────────
def start_scheduler():
    scheduler.add_job(
        send_day_after_feedback,
        CronTrigger(hour=9, minute=0, timezone="Asia/Seoul"),
        id="day_after_feedback",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    scheduler.start()
    logger.info("APScheduler 시작 — 매일 09:00 피드백 발송")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("APScheduler 종료")
