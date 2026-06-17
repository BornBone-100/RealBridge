"""
3rd Vibe — 알림 트리거 API
============================
내부 서비스 (Next.js 서버, scheduler 등)에서 호출하는
카카오 알림톡 발송 엔드포인트입니다.

  POST /api/notify/join     회원가입 완료 알림톡
  POST /api/notify/payment  결제 완료 알림톡
  POST /api/notify/match    매칭 성사 알림톡
"""

from __future__ import annotations

import os
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from database import get_admin_db
from services.kakao_notify import notify_join, notify_payment, notify_match

router = APIRouter(prefix="/api/notify", tags=["notify"])

INTERNAL_SECRET = os.getenv("INTERNAL_API_SECRET", "")  # 내부 호출 인증용


# ── 스키마 ────────────────────────────────────────────────
class UserNotifyRequest(BaseModel):
    user_id: str
    secret: str = ""   # INTERNAL_API_SECRET 값 (선택)


class MatchNotifyRequest(BaseModel):
    match_id: str
    secret: str = ""


def _auth(secret: str) -> bool:
    """내부 시크릿 검증 (설정 없으면 통과)"""
    if not INTERNAL_SECRET:
        return True
    return secret == INTERNAL_SECRET


# ── 엔드포인트 ───────────────────────────────────────────

@router.post("/join")
async def trigger_join_notify(req: UserNotifyRequest, db=Depends(get_admin_db)):
    """회원가입 완료 알림톡 발송"""
    if not _auth(req.secret):
        return {"success": False, "reason": "unauthorized"}

    u = db.table("users").select("phone, name").eq("id", req.user_id).maybe_single().execute()
    if not u.data or not u.data.get("phone"):
        return {"success": False, "reason": "user not found or no phone"}

    ok = await notify_join(u.data["phone"], u.data.get("name") or "회원")
    return {"success": ok}


@router.post("/payment")
async def trigger_payment_notify(req: UserNotifyRequest, db=Depends(get_admin_db)):
    """결제 완료 알림톡 발송"""
    if not _auth(req.secret):
        return {"success": False, "reason": "unauthorized"}

    u = db.table("users").select("phone, name").eq("id", req.user_id).maybe_single().execute()
    if not u.data or not u.data.get("phone"):
        return {"success": False, "reason": "user not found or no phone"}

    ok = await notify_payment(u.data["phone"], u.data.get("name") or "회원")
    return {"success": ok}


@router.post("/match")
async def trigger_match_notify(req: MatchNotifyRequest, db=Depends(get_admin_db)):
    """매칭 성사 알림톡 — 양쪽 유저 모두에게 발송"""
    if not _auth(req.secret):
        return {"success": False, "reason": "unauthorized"}

    match = db.table("matches").select("user_a_id, user_b_id").eq("id", req.match_id).maybe_single().execute()
    if not match.data:
        return {"success": False, "reason": "match not found"}

    results = []
    for uid in [match.data["user_a_id"], match.data["user_b_id"]]:
        u = db.table("users").select("phone, name").eq("id", uid).maybe_single().execute()
        if u.data and u.data.get("phone"):
            ok = await notify_match(u.data["phone"], u.data.get("name") or "회원")
            results.append(ok)

    return {"success": all(results), "sent": len(results)}
