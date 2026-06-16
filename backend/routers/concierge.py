"""
3rd Vibe — 컨시어지 채팅 & Solapi 알림 API
=============================================
- POST /api/concierge/send    : 유저 → 관리자 메시지 전송 + Solapi SMS 알림
- POST /api/concierge/reply   : 관리자 → 유저 답장
- GET  /api/concierge/{user_id}: 채팅 내역 조회
"""

from __future__ import annotations

import hashlib
import hmac
import httpx
import os
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from database import get_admin_db

router = APIRouter(prefix="/api/concierge", tags=["concierge"])

SOLAPI_API_KEY    = os.getenv("SOLAPI_API_KEY", "")
SOLAPI_API_SECRET = os.getenv("SOLAPI_API_SECRET", "")
ADMIN_PHONE       = os.getenv("ADMIN_PHONE", "")       # 관리자 수신 번호
SENDER_PHONE      = os.getenv("SENDER_PHONE", "")      # 발신 번호 (Solapi 등록)
SOLAPI_API_BASE   = "https://api.solapi.com"


def _normalize_phone(phone: str) -> str:
    """010-xxxx-xxxx / 010 xxxx xxxx → 01xxxxxxxxxx (Solapi 형식)"""
    return phone.replace("-", "").replace(" ", "")


# ── Solapi SMS 헬퍼 ───────────────────────────────────────
async def send_solapi_sms(to: str, text: str) -> bool:
    """Solapi로 SMS 발송"""
    if not SOLAPI_API_KEY or not SOLAPI_API_SECRET or not SENDER_PHONE or not to:
        return False  # 설정 없으면 조용히 스킵

    to = _normalize_phone(to)

    date_str  = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
    salt      = os.urandom(16).hex()
    signature = hmac.new(
        SOLAPI_API_SECRET.encode(),
        f"{date_str}{salt}".encode(),
        hashlib.sha256
    ).hexdigest()
    auth = f"HMAC-SHA256 apiKey={SOLAPI_API_KEY}, date={date_str}, salt={salt}, signature={signature}"

    payload = {
        "message": {
            "to": to,
            "from": _normalize_phone(SENDER_PHONE),
            "text": text,
        }
    }

    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{SOLAPI_API_BASE}/messages/v4/send",
                json=payload,
                headers={"Authorization": auth},
                timeout=5,
            )
            return r.status_code == 200
    except Exception:
        return False


# ── 스키마 ────────────────────────────────────────────────
class SendMessageRequest(BaseModel):
    user_id: str
    content: str


class ReplyRequest(BaseModel):
    user_id: str
    content: str


# ── 엔드포인트 ────────────────────────────────────────────
@router.post("/send")
async def send_message(req: SendMessageRequest, db=Depends(get_admin_db)):
    """
    유저 → 관리자 메시지 전송.
    Supabase에 저장 후 Solapi로 관리자에게 SMS 알림.
    """
    if not req.content.strip():
        raise HTTPException(status_code=400, detail="메시지 내용을 입력해 주세요.")

    # 유저 정보 조회
    user_res = db.table("users").select("name, phone").eq("id", req.user_id).single().execute()
    user = user_res.data if user_res.data else {"name": "알 수 없음", "phone": ""}

    # DB 저장
    db.table("concierge_messages").insert({
        "user_id": req.user_id,
        "content": req.content,
        "is_from_admin": False,
    }).execute()

    # Solapi SMS 알림 (관리자에게)
    sms_text = (
        f"[3rd Vibe 문의]\n"
        f"유저: {user['name']} ({user['phone'][-4:] if user['phone'] else '????'})\n"
        f"내용: {req.content[:50]}{'...' if len(req.content) > 50 else ''}\n"
        f"앱 관리자 콘솔에서 확인하세요."
    )
    await send_solapi_sms(ADMIN_PHONE, sms_text)

    return {"success": True}


@router.post("/reply")
async def admin_reply(req: ReplyRequest, db=Depends(get_admin_db)):
    """관리자 → 유저 답장 전송"""
    if not req.content.strip():
        raise HTTPException(status_code=400, detail="메시지 내용을 입력해 주세요.")

    # DB 저장
    db.table("concierge_messages").insert({
        "user_id": req.user_id,
        "content": req.content,
        "is_from_admin": True,
    }).execute()

    # 유저에게 SMS 알림
    user_res = db.table("users").select("phone").eq("id", req.user_id).single().execute()
    if user_res.data and user_res.data.get("phone"):
        await send_solapi_sms(
            user_res.data["phone"],
            f"[3rd Vibe 매니저]\n{req.content[:80]}\n앱에서 전체 답변을 확인하세요."
        )

    return {"success": True}


@router.get("/{user_id}")
async def get_chat_history(user_id: str, db=Depends(get_admin_db)):
    """유저의 컨시어지 채팅 내역 조회"""
    result = db.table("concierge_messages").select("*").eq(
        "user_id", user_id
    ).order("created_at").execute()

    # 읽음 처리 (어드민 메시지)
    db.table("concierge_messages").update({"is_read": True}).eq(
        "user_id", user_id
    ).eq("is_from_admin", True).eq("is_read", False).execute()

    return {"messages": result.data}


@router.get("/admin/unread")
async def get_unread_for_admin(db=Depends(get_admin_db)):
    """관리자용: 읽지 않은 유저 문의 목록"""
    result = db.table("concierge_messages").select(
        "user_id, content, created_at, users(name, phone)"
    ).eq("is_from_admin", False).eq("is_read", False).order(
        "created_at", desc=True
    ).execute()

    return {"unread_count": len(result.data), "messages": result.data}
