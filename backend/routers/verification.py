"""
3rd Vibe — 서류 인증 API (Supabase Storage + 관리자 승인)
==========================================================
엔드포인트:
  POST /api/verification/upload-url   Storage presigned URL 발급
  POST /api/verification/submit       서류 제출 완료 알림
  POST /api/verification/email/send   직장 이메일 인증 코드 발송
  POST /api/verification/email/verify 이메일 코드 검증
  GET  /api/verification/status/{uid} 본인 인증 상태 조회
  GET  /api/verification/admin/pending  관리자: 대기 목록
  POST /api/verification/admin/approve  관리자: 승인
  POST /api/verification/admin/reject   관리자: 반려
"""

from __future__ import annotations

import os
import random
import string
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from database import get_admin_db, get_db
from routers.concierge import send_solapi_sms

router = APIRouter(prefix="/api/verification", tags=["verification"])

SUPABASE_URL         = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
ADMIN_PHONE          = os.getenv("ADMIN_PHONE", "")
BUCKET               = "verification-docs"


# ── 스키마 ────────────────────────────────────────────────
class UploadUrlRequest(BaseModel):
    user_id: str
    doc_type: str  # "id_card" | "business_card" | "income_proof"
    mime_type: str = "image/jpeg"


class SubmitRequest(BaseModel):
    user_id: str
    work_email: str | None = None
    id_card_path: str | None = None
    business_card_path: str | None = None
    income_proof_path: str | None = None


class EmailSendRequest(BaseModel):
    user_id: str
    work_email: str


class EmailVerifyRequest(BaseModel):
    user_id: str
    code: str


class AdminDecisionRequest(BaseModel):
    user_id: str
    note: str = ""


# ── Supabase Storage presigned URL 헬퍼 ──────────────────
async def create_presigned_url(path: str, content_type: str) -> str:
    """
    Supabase Storage에 업로드할 presigned URL 생성.
    실제 SDK: supabase.storage.from_(BUCKET).create_signed_upload_url(path)
    """
    # supabase-py v2 방식 (service role)
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}"
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type":  content_type,
        "x-upsert":      "true",
    }
    # 실제 구현에서는 supabase-py의 create_signed_upload_url 사용
    return url  # 데모용 — 실제는 signed URL 반환


def _gen_code(length: int = 6) -> str:
    return ''.join(random.choices(string.digits, k=length))


# ── 엔드포인트 ────────────────────────────────────────────
@router.post("/upload-url")
async def get_upload_url(req: UploadUrlRequest, db=Depends(get_admin_db)):
    """
    Supabase Storage 업로드 URL 발급.
    클라이언트는 이 URL로 직접 PUT 요청하여 파일 업로드.
    """
    allowed = {"id_card", "business_card", "income_proof"}
    if req.doc_type not in allowed:
        raise HTTPException(400, f"doc_type은 {allowed} 중 하나여야 합니다.")

    ext  = "pdf" if req.mime_type == "application/pdf" else "jpg"
    path = f"{req.user_id}/{req.doc_type}.{ext}"
    url  = await create_presigned_url(path, req.mime_type)

    return {"upload_url": url, "storage_path": path}


@router.post("/email/send")
async def send_email_code(req: EmailSendRequest, db=Depends(get_admin_db)):
    """직장 이메일로 6자리 인증 코드 발송"""
    code    = _gen_code()
    expires = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()

    # DB에 코드 저장
    existing = db.table("verification_documents").select("id").eq(
        "user_id", req.user_id
    ).execute()

    if existing.data:
        db.table("verification_documents").update({
            "work_email":             req.work_email,
            "work_email_verified":    False,
            "work_email_code":        code,
            "work_email_expires_at":  expires,
        }).eq("user_id", req.user_id).execute()
    else:
        db.table("verification_documents").insert({
            "user_id":               req.user_id,
            "work_email":            req.work_email,
            "work_email_code":       code,
            "work_email_expires_at": expires,
        }).execute()

    # 실제: 이메일 발송 API 호출 (Mailgun / AWS SES 등)
    # 여기서는 로그만 출력 (개발 환경)
    import logging
    logging.getLogger(__name__).info(
        f"[EMAIL CODE] {req.work_email} → {code}"
    )

    return {"sent": True, "expires_in_minutes": 10}


@router.post("/email/verify")
async def verify_email_code(req: EmailVerifyRequest, db=Depends(get_admin_db)):
    """이메일 인증 코드 검증"""
    doc_res = db.table("verification_documents").select(
        "work_email_code, work_email_expires_at"
    ).eq("user_id", req.user_id).execute()

    if not doc_res.data:
        raise HTTPException(404, "인증 요청을 먼저 해주세요.")

    doc     = doc_res.data[0]
    expires = datetime.fromisoformat(doc["work_email_expires_at"])

    if datetime.now(timezone.utc) > expires:
        raise HTTPException(400, "인증 코드가 만료되었습니다. 다시 요청해 주세요.")

    if doc["work_email_code"] != req.code:
        raise HTTPException(400, "인증 코드가 올바르지 않습니다.")

    db.table("verification_documents").update({
        "work_email_verified": True,
        "work_email_code":     None,
    }).eq("user_id", req.user_id).execute()

    return {"verified": True}


@router.post("/submit")
async def submit_documents(req: SubmitRequest, db=Depends(get_admin_db)):
    """
    서류 업로드 완료 후 심사 신청.
    관리자에게 Solapi SMS 알림 발송.
    """
    update: dict = {"status": "pending"}
    if req.id_card_path:
        update["id_card_storage_path"] = req.id_card_path
    if req.business_card_path:
        update["business_card_path"] = req.business_card_path
    if req.income_proof_path:
        update["income_proof_path"] = req.income_proof_path

    existing = db.table("verification_documents").select("id").eq(
        "user_id", req.user_id
    ).execute()

    if existing.data:
        db.table("verification_documents").update(update).eq(
            "user_id", req.user_id
        ).execute()
    else:
        update["user_id"] = req.user_id
        db.table("verification_documents").insert(update).execute()

    # 유저 정보 조회
    user_res = db.table("users").select("name, phone").eq(
        "id", req.user_id
    ).execute()
    user = user_res.data[0] if user_res.data else {"name": "알 수 없음", "phone": ""}

    # 관리자 SMS 알림
    await send_solapi_sms(
        ADMIN_PHONE,
        f"[3rd Vibe 인증 요청]\n"
        f"{user['name']}님이 서류를 제출했습니다.\n"
        f"관리자 대시보드에서 확인 후 승인해 주세요."
    )

    return {"submitted": True}


@router.get("/status/{user_id}")
async def get_verification_status(user_id: str, db=Depends(get_admin_db)):
    """인증 상태 조회"""
    doc_res = db.table("verification_documents").select("*").eq(
        "user_id", user_id
    ).execute()
    user_res = db.table("users").select(
        "verification_status"
    ).eq("id", user_id).single().execute()

    return {
        "verification_status": user_res.data["verification_status"] if user_res.data else "pending",
        "documents":           doc_res.data[0] if doc_res.data else None,
    }


# ── 관리자 전용 ───────────────────────────────────────────
@router.get("/admin/pending")
async def get_pending_verifications(db=Depends(get_admin_db)):
    """관리자: 심사 대기 목록"""
    result = db.table("verification_documents").select(
        "*, users(name, phone, occupation, company_name, created_at)"
    ).eq("status", "pending").order("created_at").execute()

    return {"count": len(result.data), "items": result.data}


@router.post("/admin/approve")
async def approve_verification(req: AdminDecisionRequest, db=Depends(get_admin_db)):
    """관리자: 서류 인증 승인 → users.verification_status = 'approved'"""
    db.table("verification_documents").update({
        "status":      "approved",
        "admin_note":  req.note,
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("user_id", req.user_id).execute()

    db.table("users").update({
        "verification_status": "approved"
    }).eq("id", req.user_id).execute()

    # 유저에게 승인 SMS
    user_res = db.table("users").select("phone, name").eq(
        "id", req.user_id
    ).execute()
    if user_res.data:
        u = user_res.data[0]
        await send_solapi_sms(
            u["phone"],
            f"[3rd Vibe] {u['name']}님 인증이 승인되었습니다! 🎉\n"
            f"앱에서 보증금 결제 후 매칭을 시작해 보세요."
        )

    return {"approved": True}


@router.post("/admin/reject")
async def reject_verification(req: AdminDecisionRequest, db=Depends(get_admin_db)):
    """관리자: 서류 인증 반려"""
    db.table("verification_documents").update({
        "status":      "rejected",
        "admin_note":  req.note,
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("user_id", req.user_id).execute()

    db.table("users").update({
        "verification_status": "rejected"
    }).eq("id", req.user_id).execute()

    # 유저에게 반려 SMS
    user_res = db.table("users").select("phone, name").eq(
        "id", req.user_id
    ).execute()
    if user_res.data:
        u = user_res.data[0]
        reason = req.note or "서류 미흡"
        await send_solapi_sms(
            u["phone"],
            f"[3rd Vibe] {u['name']}님, 인증 서류 검토 결과 반려되었습니다.\n"
            f"사유: {reason}\n"
            f"앱에서 서류를 재제출해 주세요."
        )

    return {"rejected": True}
