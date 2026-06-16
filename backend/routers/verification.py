"""
3rd Vibe — 투트랙(직장인/대학생) 서류 인증 API
=================================================
직장인 트랙: 직장 이메일 + 신분증 + 명함/사원증 + 소득증빙(선택)
대학생 트랙: 대학교 이메일(.ac.kr) + 신분증 + 학생증

엔드포인트:
  POST /api/verification/email/send    이메일 인증 코드 발송 (트랙별 검증)
  POST /api/verification/email/verify  코드 검증
  POST /api/verification/submit        서류 제출 완료 신청
  GET  /api/verification/status/{uid}  인증 상태 조회
  GET  /api/verification/admin/pending 관리자: 심사 대기 목록 (트랙별 분류)
  POST /api/verification/admin/approve 관리자: 승인 + SMS 알림
  POST /api/verification/admin/reject  관리자: 반려 + SMS 알림
"""

from __future__ import annotations

import os
import random
import string
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import get_admin_db
from routers.concierge import send_solapi_sms

router = APIRouter(prefix="/api/verification", tags=["verification"])

ADMIN_PHONE  = os.getenv("ADMIN_PHONE", "")
BUCKET       = "verification-docs"
VALID_TRACKS = {"worker", "student"}

# 무료 이메일 도메인 (직장인 트랙에서 차단)
_FREE_DOMAINS = {
    "gmail.com", "naver.com", "kakao.com", "daum.net", "hanmail.net",
    "hotmail.com", "outlook.com", "yahoo.com", "nate.com", "icloud.com",
}


# ── 헬퍼 ─────────────────────────────────────────────────
def _gen_code(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))

def _is_ac_kr(email: str) -> bool:
    return email.strip().lower().endswith(".ac.kr")

def _is_work_email(email: str) -> bool:
    domain = email.strip().lower().split("@")[-1]
    return domain not in _FREE_DOMAINS

def _email_cols(track: str) -> tuple[str, str, str, str]:
    """(email_col, code_col, expires_col, verified_col)"""
    if track == "student":
        return ("university_email", "university_email_code",
                "university_email_expires_at", "university_email_verified")
    return ("work_email", "work_email_code",
            "work_email_expires_at", "work_email_verified")


# ── 스키마 ───────────────────────────────────────────────
class EmailSendRequest(BaseModel):
    user_id:    str
    work_email: str
    track:      str = "worker"


class EmailVerifyRequest(BaseModel):
    user_id: str
    code:    str
    track:   str = "worker"


class SubmitRequest(BaseModel):
    user_id:            str
    track:              str = "worker"
    id_card_path:       str | None = None
    # 직장인 전용
    business_card_path: str | None = None
    income_proof_path:  str | None = None
    # 대학생 전용
    student_id_path:    str | None = None


class AdminDecisionRequest(BaseModel):
    user_id: str
    note:    str = ""


# ── 이메일 인증 코드 발송 ─────────────────────────────────
@router.post("/email/send")
async def send_email_code(req: EmailSendRequest, db=Depends(get_admin_db)):
    """
    직장인 트랙: 무료 도메인 차단
    대학생 트랙: .ac.kr 도메인만 허용
    """
    if req.track not in VALID_TRACKS:
        raise HTTPException(400, "track은 'worker' 또는 'student'이어야 합니다.")

    email = req.work_email.strip()

    if req.track == "student":
        if not _is_ac_kr(email):
            raise HTTPException(400, "대학교 이메일(.ac.kr)만 사용 가능합니다.")
    else:
        if not _is_work_email(email):
            raise HTTPException(400, "개인 이메일은 사용할 수 없습니다. 직장 이메일을 입력해 주세요.")

    code    = _gen_code()
    expires = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    ec, cc, exp_c, ver_c = _email_cols(req.track)

    payload = { ec: email, cc: code, exp_c: expires, ver_c: False, "user_type": req.track }

    existing = db.table("verification_documents").select("id").eq("user_id", req.user_id).execute()
    if existing.data:
        db.table("verification_documents").update(payload).eq("user_id", req.user_id).execute()
    else:
        payload["user_id"] = req.user_id
        db.table("verification_documents").insert(payload).execute()

    # 개발 환경 로깅 (프로덕션: AWS SES / Mailgun / Resend 연동)
    import logging
    logging.getLogger(__name__).info(f"[EMAIL CODE | {req.track}] {email} → {code}")

    return {"sent": True, "track": req.track, "expires_in_minutes": 10}


# ── 이메일 인증 코드 검증 ─────────────────────────────────
@router.post("/email/verify")
async def verify_email_code(req: EmailVerifyRequest, db=Depends(get_admin_db)):
    if req.track not in VALID_TRACKS:
        raise HTTPException(400, "유효하지 않은 track 값입니다.")

    _ec, cc, exp_c, ver_c = _email_cols(req.track)

    doc_res = db.table("verification_documents").select(
        f"{cc}, {exp_c}"
    ).eq("user_id", req.user_id).execute()

    if not doc_res.data:
        raise HTTPException(404, "인증 요청을 먼저 해주세요.")

    doc = doc_res.data[0]
    expires_raw = doc.get(exp_c)
    if not expires_raw:
        raise HTTPException(400, "인증 코드 요청 이력이 없습니다.")

    if datetime.now(timezone.utc) > datetime.fromisoformat(expires_raw):
        raise HTTPException(400, "인증 코드가 만료되었습니다. 다시 요청해 주세요.")

    if doc.get(cc) != req.code:
        raise HTTPException(400, "인증 코드가 올바르지 않습니다.")

    db.table("verification_documents").update({
        ver_c: True, cc: None,
    }).eq("user_id", req.user_id).execute()

    return {"verified": True, "track": req.track}


# ── 서류 제출 신청 ────────────────────────────────────────
@router.post("/submit")
async def submit_documents(req: SubmitRequest, db=Depends(get_admin_db)):
    """
    트랙별 필수 서류 검증 후 pending 상태로 저장.
    관리자에게 Solapi SMS 알림 발송.
    """
    if req.track not in VALID_TRACKS:
        raise HTTPException(400, "유효하지 않은 track 값입니다.")

    # 트랙별 필수 서류 검증
    if req.track == "worker" and (not req.id_card_path or not req.business_card_path):
        raise HTTPException(400, "직장인 트랙: 신분증과 명함/사원증은 필수입니다.")
    if req.track == "student" and (not req.id_card_path or not req.student_id_path):
        raise HTTPException(400, "대학생 트랙: 신분증과 학생증은 필수입니다.")

    update: dict = {
        "status":               "pending",
        "user_type":            req.track,
        "id_card_storage_path": req.id_card_path,
    }
    if req.track == "worker":
        if req.business_card_path:
            update["business_card_path"] = req.business_card_path
        if req.income_proof_path:
            update["income_proof_path"]  = req.income_proof_path
    else:
        if req.student_id_path:
            update["student_id_path"] = req.student_id_path

    existing = db.table("verification_documents").select("id").eq("user_id", req.user_id).execute()
    if existing.data:
        db.table("verification_documents").update(update).eq("user_id", req.user_id).execute()
    else:
        update["user_id"] = req.user_id
        db.table("verification_documents").insert(update).execute()

    # users.user_type 동기화
    db.table("users").update({"user_type": req.track}).eq("id", req.user_id).execute()

    # 관리자 SMS 알림
    user_res = db.table("users").select("name, phone").eq("id", req.user_id).execute()
    user     = user_res.data[0] if user_res.data else {"name": "알 수 없음", "phone": ""}
    label    = "직장인" if req.track == "worker" else "대학(원)생"

    await send_solapi_sms(
        ADMIN_PHONE,
        f"[3rd Vibe 인증 요청]\n"
        f"{user['name']}님 ({label})이 서류를 제출했습니다.\n"
        f"관리자 대시보드에서 확인 후 승인해 주세요."
    )

    return {"submitted": True, "track": req.track}


# ── 인증 상태 조회 ────────────────────────────────────────
@router.get("/status/{user_id}")
async def get_verification_status(user_id: str, db=Depends(get_admin_db)):
    doc_res  = db.table("verification_documents").select("*").eq("user_id", user_id).execute()
    user_res = db.table("users").select(
        "verification_status, user_type"
    ).eq("id", user_id).single().execute()

    return {
        "verification_status": user_res.data["verification_status"] if user_res.data else "pending",
        "user_type":           user_res.data.get("user_type") if user_res.data else None,
        "documents":           doc_res.data[0] if doc_res.data else None,
    }


# ── 관리자: 심사 대기 목록 ────────────────────────────────
@router.get("/admin/pending")
async def get_pending_verifications(db=Depends(get_admin_db)):
    result = db.table("verification_documents").select(
        "*, users(name, phone, user_type, occupation, company_name, created_at)"
    ).eq("status", "pending").order("created_at").execute()

    return {
        "total":    len(result.data),
        "workers":  [r for r in result.data if r.get("user_type") == "worker"],
        "students": [r for r in result.data if r.get("user_type") == "student"],
        "all":      result.data,
    }


# ── 관리자: 승인 ─────────────────────────────────────────
@router.post("/admin/approve")
async def approve_verification(req: AdminDecisionRequest, db=Depends(get_admin_db)):
    db.table("verification_documents").update({
        "status":      "approved",
        "admin_note":  req.note,
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("user_id", req.user_id).execute()

    db.table("users").update({
        "verification_status": "approved"
    }).eq("id", req.user_id).execute()

    user_res = db.table("users").select("phone, name, user_type").eq("id", req.user_id).execute()
    if user_res.data:
        u     = user_res.data[0]
        label = "직장인" if u.get("user_type") == "worker" else "대학생"
        await send_solapi_sms(
            u["phone"],
            f"[3rd Vibe] {u['name']}님 ({label}) 인증이 승인되었습니다! 🎉\n"
            f"앱에서 보증금 결제 후 매칭을 시작해 보세요."
        )

    return {"approved": True}


# ── 관리자: 반려 ─────────────────────────────────────────
@router.post("/admin/reject")
async def reject_verification(req: AdminDecisionRequest, db=Depends(get_admin_db)):
    db.table("verification_documents").update({
        "status":      "rejected",
        "admin_note":  req.note,
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("user_id", req.user_id).execute()

    db.table("users").update({
        "verification_status": "rejected"
    }).eq("id", req.user_id).execute()

    user_res = db.table("users").select("phone, name").eq("id", req.user_id).execute()
    if user_res.data:
        u = user_res.data[0]
        await send_solapi_sms(
            u["phone"],
            f"[3rd Vibe] {u['name']}님, 인증 서류 검토 결과 반려되었습니다.\n"
            f"사유: {req.note or '서류 미흡'}\n"
            f"앱에서 서류를 재제출해 주세요."
        )

    return {"rejected": True}
