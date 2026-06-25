"""
3rd Vibe — PortOne V1 (iamport) 결제 & 부분 환불 API
=====================================================
결제 구조:
  총액 30,000원 = 매칭비 15,000원(소멸) + 보증금 15,000원(귀책사유 없으면 환불)

보증금 환불 원칙:
  - 본인 귀책사유 없음 → 보증금 15,000원 전액 환불
  - 본인 귀책사유 있음 (노쇼·일방취소·잠수 등) → 환불 불가

엔드포인트:
  POST /api/payment/verify        결제 검증 & DB 기록  (웹훅 폴백용)
  POST /api/payment/refund-deposit 보증금만 부분 환불 (귀책사유 없음)
  POST /api/payment/release       보증금 소멸 처리 (귀책사유 있음)
  GET  /api/payment/status/{uid}  결제 현황 조회
  POST /api/payment/webhook       PortOne V1 웹훅

※ 주결제 검증은 Next.js API Route (portone-confirm/route.ts) 에서 처리.
  이 백엔드는 환불·소멸·웹훅 폴백 역할.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from database import get_admin_db

router = APIRouter(prefix="/api/payment", tags=["payment"])

# ── PortOne V1 설정 ────────────────────────────────────────
PORTONE_IMP_KEY    = os.getenv("PORTONE_API_KEY", "")       # REST API Key
PORTONE_IMP_SECRET = os.getenv("PORTONE_API_SECRET", "")    # REST API Secret
PORTONE_V1_BASE    = "https://api.iamport.kr"

TOTAL_AMOUNT   = 30_000
SERVICE_FEE    = 15_000   # 소멸성 수수료
DEPOSIT_AMOUNT = 15_000   # 환불성 보증금


# ── 스키마 ────────────────────────────────────────────────
class VerifyRequest(BaseModel):
    imp_uid: str
    merchant_uid: str
    user_id: str


class RefundDepositRequest(BaseModel):
    user_id: str
    reason: str = "귀책사유 없는 매칭 중단"


class ReleaseRequest(BaseModel):
    user_id: str


# ── PortOne V1 헬퍼 ───────────────────────────────────────
async def _v1_token() -> str:
    """PortOne V1 액세스 토큰 발급"""
    async with httpx.AsyncClient() as c:
        r = await c.post(
            f"{PORTONE_V1_BASE}/users/getToken",
            json={"imp_key": PORTONE_IMP_KEY, "imp_secret": PORTONE_IMP_SECRET},
            timeout=10,
        )
    data = r.json()
    token = data.get("response", {}).get("access_token")
    if not token:
        raise HTTPException(502, f"PortOne 토큰 발급 실패: {data.get('message')}")
    return token


async def _v1_get_payment(imp_uid: str, token: str) -> dict:
    """PortOne V1 결제 정보 조회"""
    async with httpx.AsyncClient() as c:
        r = await c.get(
            f"{PORTONE_V1_BASE}/payments/{imp_uid}",
            headers={"Authorization": token},
            timeout=10,
        )
    data = r.json()
    payment = data.get("response")
    if not payment:
        raise HTTPException(502, f"결제 조회 실패: {data.get('message')}")
    return payment


async def _v1_cancel_partial(
    imp_uid: str,
    amount: int,
    reason: str,
    checksum: int,
    token: str,
) -> dict:
    """PortOne V1 부분 취소
    - amount   : 이번에 환불할 금액
    - checksum : 현재 취소 가능 금액 (전체금액 - 이미 환불된 금액)
    """
    async with httpx.AsyncClient() as c:
        r = await c.post(
            f"{PORTONE_V1_BASE}/payments/cancel",
            headers={"Authorization": token},
            json={
                "imp_uid":  imp_uid,
                "amount":   amount,
                "reason":   reason,
                "checksum": checksum,
            },
            timeout=10,
        )
    data = r.json()
    if data.get("code") != 0:
        raise HTTPException(502, f"부분 환불 실패: {data.get('message')}")
    return data.get("response", {})


# ── 엔드포인트 ────────────────────────────────────────────
@router.post("/verify")
async def verify_payment(req: VerifyRequest, db=Depends(get_admin_db)):
    """
    결제 검증 & DB 기록 (웹훅 폴백 / 관리자 수동 호출용).
    주 검증은 Next.js portone-confirm/route.ts 에서 이미 처리됨.
    """
    token   = await _v1_token()
    payment = await _v1_get_payment(req.imp_uid, token)

    if payment.get("status") != "paid":
        raise HTTPException(400, "결제 미완료 상태입니다.")

    paid = payment.get("amount", 0)
    if paid != TOTAL_AMOUNT:
        await _v1_cancel_partial(req.imp_uid, paid, "금액 불일치 — 위변조 의심", paid, token)
        raise HTTPException(400, f"결제 금액 불일치: 기대 {TOTAL_AMOUNT}원, 실제 {paid}원")

    if payment.get("merchant_uid") != req.merchant_uid:
        raise HTTPException(400, "주문 정보 불일치")

    # 중복 방지
    dup = db.table("payments").select("id").eq("portone_imp_uid", req.imp_uid).execute()
    if dup.data:
        raise HTTPException(409, "이미 처리된 결제입니다.")

    now = datetime.now(timezone.utc).isoformat()
    row = db.table("payments").insert({
        "user_id":              req.user_id,
        "total_amount":         TOTAL_AMOUNT,
        "service_fee":          SERVICE_FEE,
        "deposit_amount":       DEPOSIT_AMOUNT,
        "status":               "paid",
        "portone_imp_uid":      req.imp_uid,
        "portone_merchant_uid": req.merchant_uid,
        "paid_at":              now,
    }).execute()

    db.table("users").update({"is_deposit_paid": True}).eq("id", req.user_id).execute()

    return {
        "success":     True,
        "payment_id":  row.data[0]["id"],
        "service_fee": SERVICE_FEE,
        "deposit":     DEPOSIT_AMOUNT,
        "status":      "paid",
    }


@router.post("/refund-deposit")
async def refund_deposit(req: RefundDepositRequest, db=Depends(get_admin_db)):
    """본인 귀책사유 없음 → 보증금 15,000원 부분 환불"""
    row = (
        db.table("payments")
        .select("*")
        .eq("user_id", req.user_id)
        .eq("status", "paid")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not row.data:
        raise HTTPException(404, "환불 가능한 결제 내역이 없습니다.")

    pay = row.data[0]

    if pay.get("refunded_amount", 0) > 0:
        raise HTTPException(409, "이미 환불이 처리된 결제입니다.")

    token = await _v1_token()
    await _v1_cancel_partial(
        pay["portone_imp_uid"],   # V1: imp_uid 사용
        DEPOSIT_AMOUNT,
        req.reason,
        TOTAL_AMOUNT,             # checksum: 아직 환불 없으므로 전체 금액
        token,
    )

    now = datetime.now(timezone.utc).isoformat()
    db.table("payments").update({
        "status":          "fee_only",
        "refunded_amount": DEPOSIT_AMOUNT,
        "refund_reason":   req.reason,
        "refunded_at":     now,
    }).eq("id", pay["id"]).execute()

    db.table("users").update({"is_deposit_paid": False}).eq("id", req.user_id).execute()

    return {
        "success":         True,
        "refunded_amount": DEPOSIT_AMOUNT,
        "remaining_fee":   SERVICE_FEE,
        "status":          "fee_only",
    }


@router.post("/release")
async def release_deposit(req: ReleaseRequest, db=Depends(get_admin_db)):
    """귀책사유 있음 → 보증금 소멸 (환불 불가)"""
    row = (
        db.table("payments")
        .select("*")
        .eq("user_id", req.user_id)
        .eq("status", "paid")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not row.data:
        raise HTTPException(404, "활성 결제를 찾을 수 없습니다.")

    db.table("payments").update({"status": "fully_released"}).eq(
        "id", row.data[0]["id"]
    ).execute()

    return {"success": True, "status": "fully_released"}


@router.get("/status/{user_id}")
async def get_payment_status(user_id: str, db=Depends(get_admin_db)):
    row = (
        db.table("payments")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not row.data:
        return {"has_payment": False}

    p = row.data[0]
    return {
        "has_payment":     True,
        "status":          p["status"],
        "total_amount":    p["total_amount"],
        "service_fee":     p["service_fee"],
        "deposit_amount":  p["deposit_amount"],
        "refunded_amount": p.get("refunded_amount", 0),
        "paid_at":         p["paid_at"],
        "refunded_at":     p.get("refunded_at"),
    }


@router.post("/webhook")
async def portone_webhook(request: Request, db=Depends(get_admin_db)):
    """
    PortOne V1 웹훅 수신.
    V1 웹훅은 별도 서명이 없으므로 imp_uid로 PortOne에 재조회하여 검증.
    결제 완료(paid) 이벤트만 처리하며, Next.js가 이미 처리했으면 스킵.
    """
    try:
        payload = await request.json()
    except Exception:
        return {"received": True}

    imp_uid      = payload.get("imp_uid", "")
    merchant_uid = payload.get("merchant_uid", "")
    status       = payload.get("status", "")

    if not imp_uid or status != "paid":
        return {"received": True}

    # 이미 처리된 결제면 스킵
    exists = db.table("payments").select("id").eq("portone_imp_uid", imp_uid).execute()
    if exists.data:
        return {"received": True}

    # PortOne V1로 직접 재조회하여 금액 검증
    try:
        token   = await _v1_token()
        payment = await _v1_get_payment(imp_uid, token)

        if payment.get("status") == "paid" and payment.get("amount") == TOTAL_AMOUNT:
            # merchant_uid = "3rdvibe-{userId8자리}-{timestamp}"
            parts       = merchant_uid.split("-")
            user_prefix = parts[1] if len(parts) > 1 else ""

            user_row = (
                db.table("users").select("id").like("id", f"{user_prefix}%").execute()
            )
            user_id = user_row.data[0]["id"] if user_row.data else None

            if user_id:
                now = datetime.now(timezone.utc).isoformat()
                db.table("payments").insert({
                    "user_id":              user_id,
                    "total_amount":         TOTAL_AMOUNT,
                    "service_fee":          SERVICE_FEE,
                    "deposit_amount":       DEPOSIT_AMOUNT,
                    "status":               "paid",
                    "portone_imp_uid":      imp_uid,
                    "portone_merchant_uid": merchant_uid,
                    "paid_at":              now,
                }).execute()
                db.table("users").update({"is_deposit_paid": True}).eq(
                    "id", user_id
                ).execute()
    except Exception:
        pass  # 웹훅 실패는 무시 (PortOne이 재시도함)

    return {"received": True}
