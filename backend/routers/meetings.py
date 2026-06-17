"""
3rd Vibe — 3회 만남 추적 API
==============================
- POST /api/meetings/confirm   : 만남 완료 확인 (양방향)
- GET  /api/meetings/{match_id}: 매칭별 만남 현황 조회
- POST /api/meetings/schedule  : 다음 만남 일정 등록
"""

from __future__ import annotations

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from database import get_admin_db
from services.kakao_notify import notify_meeting

router = APIRouter(prefix="/api/meetings", tags=["meetings"])


# ── 스키마 ────────────────────────────────────────────────
class ConfirmMeetingRequest(BaseModel):
    match_id: str
    meeting_number: int   # 1, 2, 3
    user_id: str          # 확인하는 유저 ID


class ScheduleMeetingRequest(BaseModel):
    match_id: str
    meeting_number: int
    location: str
    scheduled_at: str     # ISO 8601


# ── 엔드포인트 ────────────────────────────────────────────
@router.post("/confirm")
async def confirm_meeting(req: ConfirmMeetingRequest, db=Depends(get_admin_db)):
    """
    만남 완료를 양쪽 유저가 각각 확인.
    양쪽 모두 확인하면 meeting.status = 'completed'로 변경.
    3번째 만남이 완료되면 match.state = 'success'로 업데이트.
    """
    if req.meeting_number not in (1, 2, 3):
        raise HTTPException(status_code=400, detail="meeting_number는 1~3이어야 합니다.")

    # 매칭 정보 조회
    match_res = db.table("matches").select("*").eq("id", req.match_id).single().execute()
    if not match_res.data:
        raise HTTPException(status_code=404, detail="매칭을 찾을 수 없습니다.")

    match = match_res.data
    is_user_a = match["user_a_id"] == req.user_id
    is_user_b = match["user_b_id"] == req.user_id
    if not (is_user_a or is_user_b):
        raise HTTPException(status_code=403, detail="이 매칭의 참여자가 아닙니다.")

    # 미팅 레코드 조회 (없으면 생성)
    meeting_res = db.table("meetings").select("*").eq(
        "match_id", req.match_id
    ).eq("meeting_number", req.meeting_number).execute()

    if not meeting_res.data:
        # 첫 확인 → 레코드 생성
        confirm_field = "confirmed_by_a" if is_user_a else "confirmed_by_b"
        db.table("meetings").insert({
            "match_id": req.match_id,
            "meeting_number": req.meeting_number,
            "status": "scheduled",
            confirm_field: True,
        }).execute()
        return {"confirmed": True, "both_confirmed": False}

    meeting = meeting_res.data[0]

    # 이미 완료된 경우
    if meeting["status"] == "completed":
        return {"confirmed": True, "both_confirmed": True, "already_done": True}

    # 확인 필드 업데이트
    update_data: dict = {}
    if is_user_a:
        update_data["confirmed_by_a"] = True
    else:
        update_data["confirmed_by_b"] = True

    # 양쪽 확인 여부 체크
    confirmed_a = meeting["confirmed_by_a"] or is_user_a
    confirmed_b = meeting["confirmed_by_b"] or is_user_b
    both_confirmed = confirmed_a and confirmed_b

    if both_confirmed:
        update_data["status"] = "completed"
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()

    db.table("meetings").update(update_data).eq("id", meeting["id"]).execute()

    # 양쪽 완료 시 matches.meetings_done 증가
    if both_confirmed:
        new_done = match["meetings_done"] + 1
        match_update: dict = {"meetings_done": new_done}

        if new_done >= 3:
            # 3회 만남 성공!
            match_update["state"] = "success"
            match_update["closed_at"] = datetime.now(timezone.utc).isoformat()

        db.table("matches").update(match_update).eq("id", req.match_id).execute()

        return {
            "confirmed": True,
            "both_confirmed": True,
            "meetings_done": new_done,
            "match_success": new_done >= 3,
        }

    return {"confirmed": True, "both_confirmed": False}


@router.get("/{match_id}")
async def get_meetings(match_id: str, db=Depends(get_admin_db)):
    """매칭별 만남 현황 조회"""
    match_res = db.table("matches").select("*").eq("id", match_id).single().execute()
    if not match_res.data:
        raise HTTPException(status_code=404, detail="매칭을 찾을 수 없습니다.")

    meetings_res = db.table("meetings").select("*").eq(
        "match_id", match_id
    ).order("meeting_number").execute()

    return {
        "match_id": match_id,
        "match_state": match_res.data["state"],
        "meetings_done": match_res.data["meetings_done"],
        "meetings": meetings_res.data,
    }


@router.post("/schedule")
async def schedule_meeting(req: ScheduleMeetingRequest, db=Depends(get_admin_db)):
    """다음 만남 일정 등록 (어드민이 직접 조율)"""
    existing = db.table("meetings").select("id").eq(
        "match_id", req.match_id
    ).eq("meeting_number", req.meeting_number).execute()

    if existing.data:
        db.table("meetings").update({
            "location": req.location,
            "scheduled_at": req.scheduled_at,
        }).eq("id", existing.data[0]["id"]).execute()
    else:
        db.table("meetings").insert({
            "match_id": req.match_id,
            "meeting_number": req.meeting_number,
            "location": req.location,
            "scheduled_at": req.scheduled_at,
            "status": "scheduled",
        }).execute()

    # 양쪽 유저에게 만남 일정 알림톡 발송
    match_res = db.table("matches").select("user_a_id, user_b_id").eq("id", req.match_id).single().execute()
    if match_res.data:
        # scheduled_at 포맷: "2025-06-20T19:00:00" → "6월 20일 19:00"
        try:
            dt = datetime.fromisoformat(req.scheduled_at.replace("Z", "+00:00"))
            date_str = dt.strftime("%-m월 %-d일 %H:%M")
        except Exception:
            date_str = req.scheduled_at

        for uid in [match_res.data["user_a_id"], match_res.data["user_b_id"]]:
            u = db.table("users").select("phone, name").eq("id", uid).maybe_single().execute()
            if u.data and u.data.get("phone"):
                import asyncio
                asyncio.create_task(
                    notify_meeting(u.data["phone"], u.data["name"] or "회원",
                                   date_str, req.location)
                )

    return {"success": True}


@router.post("/fail/{match_id}")
async def fail_match(match_id: str, reason: str = "3회 만남 미달", db=Depends(get_admin_db)):
    """
    3회 만남 실패 처리.
    match.state = 'failed' → payment.refund 트리거.
    """
    match_res = db.table("matches").select("*").eq("id", match_id).single().execute()
    if not match_res.data:
        raise HTTPException(status_code=404, detail="매칭을 찾을 수 없습니다.")

    db.table("matches").update({
        "state": "failed",
        "closed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", match_id).execute()

    # 양쪽 유저 환불 트리거 (payment router의 refund 호출)
    import httpx
    user_ids = [match_res.data["user_a_id"], match_res.data["user_b_id"]]
    async with httpx.AsyncClient() as client:
        for uid in user_ids:
            await client.post(
                "http://localhost:8000/api/payment/refund",
                json={"user_id": uid, "reason": reason},
            )

    return {"success": True, "match_state": "failed", "refund_triggered": True}
