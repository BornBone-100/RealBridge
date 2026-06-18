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


# ── 핵심 작업: 매일 저녁 21시 실행 ───────────────────────
async def send_tonight_feedback():
    """
    오늘 날짜로 confirmed/completed 된 마일스톤에 대해
    그날 밤 21시에 피드백 서베이를 생성하고 SMS를 발송한다.
    """
    db = get_admin_db_direct()

    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    now = datetime.now(timezone.utc)

    # 1. 오늘 confirmed_datetime이 있는 마일스톤 조회 (feedback 미발송)
    milestones_res = db.table("date_milestones").select(
        "*, matches(user_a_id, user_b_id, state)"
    ).gte(
        "confirmed_datetime", today_start.isoformat()
    ).lt(
        "confirmed_datetime", now.isoformat()
    ).in_("status", ["confirmed", "completed"]).is_("feedback_sent_at", "null").execute()

    if not milestones_res.data:
        logger.info("오늘 완료 마일스톤 없음 — 피드백 발송 스킵")
        return

    for ms in milestones_res.data:
        match    = ms.get("matches", {})
        user_a   = match.get("user_a_id")
        user_b   = match.get("user_b_id")
        match_state = match.get("state")

        if match_state in ("stopped_no_fault", "stopped_fault", "cancelled"):
            continue  # 이미 중단된 매칭 스킵

        now_str = datetime.now(timezone.utc).isoformat()

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
                "sent_at":      now_str,
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
            date_themes = ["가볍게 차나 식사", "여자가 원하는 데이트", "남자가 원하는 데이트"]
            theme = date_themes[ms_no - 1] if ms_no <= 3 else f"{ms_no}차 만남"
            sms_text = (
                f"[3rd Vibe] {name}님, 오늘 {ms_no}차 만남({theme}) 어떠셨나요? 😊\n"
                f"오늘 밤 솔직한 후기를 남겨주시면\n"
                f"더 좋은 만남을 이어갈 수 있어요.\n"
                f"👉 3rd Vibe 앱 → 피드백 남기기"
            )
            await send_sms(phone, sms_text)

        # 3. feedback_sent_at 업데이트
        db.table("date_milestones").update({
            "feedback_sent_at": now_str
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

    1·2차 만남:
      - want_next_date=False → 즉시 매칭 중단 + 환불

    3차 만남 (최종 결정):
      - 양쪽 모두 응답 완료 시에만 결과 처리
      - 양쪽 Yes → match.state = 'success'
      - 한 명이라도 No → match.state = 'ended' + 환불
    """
    # 마일스톤 조회
    ms_res = db.table("date_milestones").select(
        "milestone_no, match_id, matches(id, user_a_id, user_b_id, state)"
    ).eq("id", milestone_id).single().execute()

    if not ms_res.data:
        return {"error": "마일스톤을 찾을 수 없습니다."}

    ms         = ms_res.data
    match      = ms.get("matches", {})
    ms_no      = ms.get("milestone_no", 1)
    match_id   = match.get("id")
    match_state = match.get("state")

    if match_state in ("success", "ended", "stopped_no_fault", "stopped_fault", "cancelled"):
        return {"skipped": True, "reason": "이미 종료된 매칭"}

    # ── 1·2차: 즉시 중단 ──────────────────────────────────
    if ms_no < 3 and not want_next_date:
        db.table("matches").update({
            "state":       "stopped_no_fault",
            "stopped_by":  user_id,
            "closed_at":   datetime.now(timezone.utc).isoformat(),
            "stop_reason": f"{ms_no}차 만남 후 유저 요청 종료",
        }).eq("id", match_id).execute()

        for uid in [match["user_a_id"], match["user_b_id"]]:
            async with httpx.AsyncClient(timeout=10) as c:
                await c.post(
                    f"{INTERNAL_API}/api/payment/refund-deposit",
                    json={"user_id": uid, "reason": f"{ms_no}차 만남 후 종료 — 환불"},
                )
        return {"stopped": True, "refund_triggered": True}

    # ── 3차: 상호 결정 처리 ───────────────────────────────
    if ms_no == 3:
        surveys_res = db.table("feedback_surveys").select(
            "user_id, want_next_date, is_answered, answered_at"
        ).eq("milestone_id", milestone_id).execute()

        responded = [s for s in (surveys_res.data or []) if s.get("is_answered")]

        # 양쪽 모두 응답했는지 확인
        user_a = match.get("user_a_id")
        user_b = match.get("user_b_id")
        a_res  = next((s for s in responded if s["user_id"] == user_a), None)
        b_res  = next((s for s in responded if s["user_id"] == user_b), None)

        if not (a_res and b_res):
            return {"waiting": True, "msg": "상대방 응답 대기 중"}

        both_yes = a_res["want_next_date"] and b_res["want_next_date"]

        if both_yes:
            # 매칭 성공
            db.table("matches").update({
                "state": "success",
            }).eq("id", match_id).execute()

            # 매니저에게 알림 (컨시어지 메시지)
            for uid in [user_a, user_b]:
                db.table("concierge_messages").insert({
                    "user_id":       uid,
                    "content":       "🎉 서로 계속 만나고 싶어한다는 결과가 나왔어요!\n3rd Vibe 매니저가 다음 단계를 안내드릴게요 💕",
                    "is_from_admin": True,
                    "is_read":       False,
                }).execute()

            return {"success": True, "result": "match_success"}
        else:
            # 매칭 종료 + 환불
            db.table("matches").update({
                "state":     "ended",
                "closed_at": datetime.now(timezone.utc).isoformat(),
                "stop_reason": "3차 만남 후 상호 결정 — 종료",
            }).eq("id", match_id).execute()

            for uid in [user_a, user_b]:
                async with httpx.AsyncClient(timeout=10) as c:
                    await c.post(
                        f"{INTERNAL_API}/api/payment/refund-deposit",
                        json={"user_id": uid, "reason": "3차 만남 종료 — 환불"},
                    )
            return {"stopped": True, "refund_triggered": True, "result": "ended"}

    return {"no_action": True}


# ── 스케줄러 시작/종료 ────────────────────────────────────
def start_scheduler():
    scheduler.add_job(
        send_tonight_feedback,
        CronTrigger(hour=21, minute=0, timezone="Asia/Seoul"),
        id="tonight_feedback",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    scheduler.start()
    logger.info("APScheduler 시작 — 매일 21:00 당일 데이트 피드백 발송")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("APScheduler 종료")
