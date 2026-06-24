"""
3rd Vibe — PortOne 하이브리드 결제 & 부분 환불 API
=====================================================
결제 구조:
  총액 30,000원 = 매칭비 15,000원(소멸) + 보증금 15,000원(귀책사유 없으면 환불)

보증금 환불 원칙:
  - 본인 귀책사유 없음 → 보증금 15,000원 전액 환불
  - 본인 귀책사유 있음 (노쇼·일방취소·잠수 등) → 환불 불가

엔드포인트:
  POST /api/payment/verify        결제 검증 & DB 기록
  POST /api/payment/refund-deposit 보증금만 부분 환불 (귀책사유 없음)
  POST /api/payment/release       보증금 소멸 처리 (귀책사유 있음)
  GET  /api/payment/status/{uid}  결제 현황 조회
  POST /api/payment/webhook       PortOne 웹훅
"""

from __future__ import annotations

import hashlib
import hmac
import os
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from database import get_admin_db

router = APIRouter(prefix="/api/payment", tags=["payment"])

PORTONE_API_SECRET      = os.getenv("PORTONE_API_SECRET", "")
PORTONE_STORE_ID        = os.getenv("PORTONE_STORE_ID", "")
PORTONE_WEBHOOK_SECRET  = os.getenv("PORTONE_WEBHOOK_SECRET", PORTONE_API_SECRET)  # 미설정 시 API Secret 폴백
PORTONE_API_BASE        = "https://api.portone.io"

TOTAL_AMOUNT   = 30_000
SERVICE_FEE    = 15_000   # 소멸성 수수료
DEPOSIT_AMOUNT = 15_000   # 환불성 보증금 (본인 귀책사유 없으면 환불)


# ── 스키마 ────────────────────────────────────────────────
class VerifyRequest(BaseModel):
    payment_id: str
    user_id: str


class RefundDepositRequest(BaseModel):
    user_id: str
    reason: str = "귀책사유 없는 매칭 중단"


class ReleaseRequest(BaseModel):
    user_id: str


# ── PortOne 헬퍼 ──────────────────────────────────────────
async def _get_payment(payment_id: str) -> dict:
    async with httpx.AsyncClient() as c:
        r = await c.get(
            f"{PORTONE_API_BASE}/payments/{payment_id}",
            headers={"Authorization": f"PortOne {PORTONE_API_SECRET}"},
            timeout=10,
        )
    if r.status_code != 200:
        raise HTTPException(502, f"PortOne 결제 조회 실패: {r.text}")
    return r.json()


async def _cancel_partial(payment_id: str, amount: int, reason: str) -> dict:
    """PortOne V2 부분 취소 — amount만큼만 환불"""
    async with httpx.AsyncClient() as c:
        r = await c.post(
            f"{PORTONE_API_BASE}/payments/{payment_id}/cancel",
            headers={"Authorization": f"PortOne {PORTONE_API_SECRET}"},
            json={"reason": reason, "amount": amount},
            timeout=10,
        )
    if r.status_code != 200:
        raise HTTPException(502, f"부분 환불 실패: {r.text}")
    return r.json()


# ── 엔드포인트 ────────────────────────────────────────────
@router.post("/verify")
async def verify_payment(req: VerifyRequest, db=Depends(get_admin_db)):
    """
    프론트엔드 결제 완료 후 호출.
    PortOne에서 실제 금액·상태 검증 → payments 테이블에 에스크로 기록.
    """
    payment = await _get_payment(req.payment_id)

    # 결제 상태 검증
    if payment.get("status") != "PAID":
        raise HTTPException(400, "결제 미완료 상태입니다.")

    paid = payment.get("amount", {}).get("total", 0)
    if paid != TOTAL_AMOUNT:
        await _cancel_partial(req.payment_id, paid, "금액 불일치 — 위변조 의심")
        raise HTTPException(400, f"결제 금액 불일치: 기대 {TOTAL_AMOUNT}원, 실제 {paid}원")

    # 중복 방지
    dup = db.table("payments").select("id").eq(
        "portone_payment_id", req.payment_id
    ).execute()
    if dup.data:
        raise HTTPException(409, "이미 처리된 결제입니다.")

    now = datetime.now(timezone.utc).isoformat()
    row = db.table("payments").insert({
        "user_id":             req.user_id,
        "total_amount":        TOTAL_AMOUNT,
        "service_fee":         SERVICE_FEE,
        "deposit_amount":      DEPOSIT_AMOUNT,
        "status":              "paid",
        "portone_payment_id":  req.payment_id,
        "portone_tx_id":       payment.get("id"),
        "portone_receipt_url": payment.get("receiptUrl"),
        "paid_at":             now,
    }).execute()

    # 유저 is_deposit_paid 갱신
    db.table("users").update({"is_deposit_paid": True}).eq("id", req.user_id).execute()

    return {
        "success":       True,
        "payment_id":    row.data[0]["id"],
        "service_fee":   SERVICE_FEE,
        "deposit":       DEPOSIT_AMOUNT,
        "status":        "paid",
    }


@router.post("/refund-deposit")
async def refund_deposit(req: RefundDepositRequest, db=Depends(get_admin_db)):
    """
    본인 귀책사유 없는 경우 → 보증금 15,000원 부분 환불.
    서비스 수수료 30,000원은 소멸.
    어드민 또는 시스템이 호출.
    """
    row = db.table("payments").select("*").eq("user_id", req.user_id).eq(
        "status", "paid"
    ).order("created_at", desc=True).limit(1).execute()

    if not row.data:
        raise HTTPException(404, "환불 가능한 결제 내역이 없습니다.")

    pay = row.data[0]

    if pay["refunded_amount"] > 0:
        raise HTTPException(409, "이미 환불이 처리된 결제입니다.")

    # PortOne 부분 취소 — 보증금만
    await _cancel_partial(
        pay["portone_payment_id"],
        DEPOSIT_AMOUNT,
        req.reason,
    )

    now = datetime.now(timezone.utc).isoformat()
    db.table("payments").update({
        "status":           "fee_only",   # 수수료만 남음
        "refunded_amount":  DEPOSIT_AMOUNT,
        "refund_reason":    req.reason,
        "refunded_at":      now,
    }).eq("id", pay["id"]).execute()

    db.table("users").update({"is_deposit_paid": False}).eq(
        "id", req.user_id
    ).execute()

    return {
        "success":          True,
        "refunded_amount":  DEPOSIT_AMOUNT,
        "remaining_fee":    SERVICE_FEE,
        "status":           "fee_only",
    }


@router.post("/release")
async def release_deposit(req: ReleaseRequest, db=Depends(get_admin_db)):
    """
    본인 귀책사유 있음 → 보증금 소멸 처리 (환불 불가).
    더 이상 환불 불가 상태로 변경.
    """
    row = db.table("payments").select("*").eq("user_id", req.user_id).eq(
        "status", "paid"
    ).order("created_at", desc=True).limit(1).execute()

    if not row.data:
        raise HTTPException(404, "활성 결제를 찾을 수 없습니다.")

    db.table("payments").update({
        "status": "fully_released",
    }).eq("id", row.data[0]["id"]).execute()

    return {"success": True, "status": "fully_released"}


@router.get("/status/{user_id}")
async def get_payment_status(user_id: str, db=Depends(get_admin_db)):
    row = db.table("payments").select("*").eq("user_id", user_id).order(
        "created_at", desc=True
    ).limit(1).execute()

    if not row.data:
        return {"has_payment": False}

    p = row.data[0]
    return {
        "has_payment":     True,
        "status":          p["status"],
        "total_amount":    p["total_amount"],
        "service_fee":     p["service_fee"],
        "deposit_amount":  p["deposit_amount"],
        "refunded_amount": p["refunded_amount"],
        "paid_at":         p["paid_at"],
        "refunded_at":     p.get("refunded_at"),
    }


@router.post("/webhook")
async def portone_webhook(request: Request, db=Depends(get_admin_db)):
    """
    PortOne 웹훅 — 서명 검증 후 상태 동기화.
    서명 검증은 PORTONE_WEBHOOK_SECRET (웹훅 전용 시크릿) 사용.
    PortOne 대시보드 → 웹훅 설정에서 발급받은 값을 .env에 설정하세요.
    """
    body = await request.body()
    sig  = request.headers.get("webhook-signature", "")
    expected = hmac.new(
        PORTONE_WEBHOOK_SECRET.encode(), body, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected, sig):
        raise HTTPException(401, "웹훅 서명 불일치")

    payload    = await request.json()
    event_type = payload.get("type", "")
    payment_id = payload.get("data", {}).get("paymentId", "")

    if event_type == "Transaction.Paid" and payment_id:
        # DB에 payment_id가 없으면 verify 처리
        exists = db.table("payments").select("id").eq(
            "portone_payment_id", payment_id
        ).execute()
        if not exists.data:
            user_id = payload.get("data", {}).get("customData", {}).get("user_id")
            if user_id:
                await verify_payment(
                    VerifyRequest(payment_id=payment_id, user_id=user_id), db
                )

    return {"received": True}
