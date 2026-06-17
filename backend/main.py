import os
import hmac
import hashlib
import logging
from datetime import datetime, timedelta
from collections import defaultdict
from threading import Lock

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

# ── 로깅 설정 ──────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# ── 새 라우터 임포트 ───────────────────────────────────────
from routers import payment, verification, meetings, concierge, demo, notify
from scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작 시 스케줄러 실행, 종료 시 정지."""
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="3rd Vibe API", lifespan=lifespan)

# ── 라우터 등록 ────────────────────────────────────────────
app.include_router(payment.router)
app.include_router(verification.router)
app.include_router(meetings.router)
app.include_router(concierge.router)
app.include_router(demo.router)
app.include_router(notify.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://yourdomain.com"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# ── 환경변수 ──────────────────────────────────────────────
SUMSUB_SECRET_KEY: str = os.environ["SUMSUB_SECRET_KEY"]
KYC_CONFIDENCE_THRESHOLD: float = float(os.getenv("KYC_CONFIDENCE_THRESHOLD", "0.95"))

# Rate Limit 설정 (환경변수로 조정 가능)
RATE_LIMIT_KYC_START: int = int(os.getenv("RATE_LIMIT_KYC_START", "3"))    # 1시간에 3회
RATE_LIMIT_KYC_WINDOW: int = int(os.getenv("RATE_LIMIT_KYC_WINDOW", "3600"))  # 초 단위
RATE_LIMIT_WEBHOOK: int = int(os.getenv("RATE_LIMIT_WEBHOOK", "30"))        # 1분에 30회
RATE_LIMIT_WEBHOOK_WINDOW: int = int(os.getenv("RATE_LIMIT_WEBHOOK_WINDOW", "60"))


# ════════════════════════════════════════════════════════════
# SECTION 1: Rate Limiter
# ════════════════════════════════════════════════════════════

class RateLimiter:
    """
    슬라이딩 윈도우 방식의 인메모리 Rate Limiter.
    실제 서비스에서는 Redis로 교체 권장 (다중 서버 환경 대응).
    """

    def __init__(self):
        # {key: [timestamp, timestamp, ...]}
        self._requests: dict[str, list[datetime]] = defaultdict(list)
        self._lock = Lock()

    def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> tuple[bool, int]:
        """
        요청 허용 여부를 반환합니다.
        Returns: (allowed: bool, retry_after_seconds: int)
        """
        now = datetime.utcnow()
        window_start = now - timedelta(seconds=window_seconds)

        with self._lock:
            # 윈도우 밖의 오래된 요청 기록 제거
            self._requests[key] = [
                ts for ts in self._requests[key] if ts > window_start
            ]

            if len(self._requests[key]) >= max_requests:
                # 가장 오래된 요청이 만료되기까지 남은 시간
                oldest = self._requests[key][0]
                retry_after = int((oldest + timedelta(seconds=window_seconds) - now).total_seconds()) + 1
                return False, retry_after

            self._requests[key].append(now)
            return True, 0


rate_limiter = RateLimiter()


def get_client_ip(request: Request) -> str:
    """프록시(Nginx, CloudFlare) 뒤에서도 실제 클라이언트 IP를 추출합니다."""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host


def rate_limit_kyc_start(request: Request):
    """KYC 시작 엔드포인트: IP당 1시간에 3회 제한 (무차별 인증 시도 방지)"""
    ip = get_client_ip(request)
    allowed, retry_after = rate_limiter.is_allowed(
        key=f"kyc_start:{ip}",
        max_requests=RATE_LIMIT_KYC_START,
        window_seconds=RATE_LIMIT_KYC_WINDOW,
    )
    if not allowed:
        logger.warning(f"Rate limit 초과 (KYC 시작) — IP={ip}, retry_after={retry_after}s")
        raise HTTPException(
            status_code=429,
            detail=f"너무 많은 인증 시도입니다. {retry_after}초 후 다시 시도해 주세요.",
            headers={"Retry-After": str(retry_after)},
        )


def rate_limit_webhook(request: Request):
    """웹훅 엔드포인트: IP당 1분에 30회 제한 (DoS 방지)"""
    ip = get_client_ip(request)
    allowed, retry_after = rate_limiter.is_allowed(
        key=f"webhook:{ip}",
        max_requests=RATE_LIMIT_WEBHOOK,
        window_seconds=RATE_LIMIT_WEBHOOK_WINDOW,
    )
    if not allowed:
        logger.warning(f"Rate limit 초과 (웹훅) — IP={ip}")
        raise HTTPException(
            status_code=429,
            detail="Too many requests.",
            headers={"Retry-After": str(retry_after)},
        )


# ════════════════════════════════════════════════════════════
# SECTION 2: Device Fingerprint 블랙리스트
# ════════════════════════════════════════════════════════════

class DeviceBlacklist:
    """
    차단된 기기 지문(Device Fingerprint)을 관리합니다.
    실제 서비스에서는 Redis SET 또는 PostgreSQL 테이블로 교체 권장.
    """

    def __init__(self):
        # {fingerprint: {"banned_at": datetime, "reason": str, "user_id": str}}
        self._blacklist: dict[str, dict] = {}
        self._lock = Lock()

    def ban(self, fingerprint: str, user_id: str, reason: str) -> None:
        with self._lock:
            self._blacklist[fingerprint] = {
                "banned_at": datetime.utcnow().isoformat(),
                "reason": reason,
                "user_id": user_id,
            }
        logger.warning(f"기기 차단 등록 — fingerprint={fingerprint[:12]}..., user_id={user_id}, reason={reason}")

    def is_banned(self, fingerprint: str) -> bool:
        return fingerprint in self._blacklist

    def get_info(self, fingerprint: str) -> dict | None:
        return self._blacklist.get(fingerprint)


device_blacklist = DeviceBlacklist()


class DeviceRegistrationRequest(BaseModel):
    user_id: str
    device_fingerprint: str  # FingerprintJS Pro visitorId 값


class DeviceCheckRequest(BaseModel):
    device_fingerprint: str


# ── 기기 지문 검증 의존성 ──────────────────────────────────
async def check_device_not_banned(request: Request) -> str:
    """
    요청 헤더의 X-Device-Fingerprint 값으로 차단 여부를 확인합니다.
    가입/인증 시작 엔드포인트에 Depends()로 연결해서 사용합니다.
    """
    fingerprint = request.headers.get("X-Device-Fingerprint")
    if not fingerprint:
        raise HTTPException(status_code=400, detail="Device fingerprint header is required.")

    if device_blacklist.is_banned(fingerprint):
        info = device_blacklist.get_info(fingerprint)
        logger.warning(
            f"차단된 기기 접근 시도 — fingerprint={fingerprint[:12]}..., "
            f"original_user={info['user_id']}, reason={info['reason']}"
        )
        raise HTTPException(
            status_code=403,
            detail="이 기기는 정책 위반으로 인해 서비스 이용이 영구 차단되었습니다.",
        )

    return fingerprint


# ════════════════════════════════════════════════════════════
# SECTION 3: DB & 모델 (투트랙 인증 포함)
# ════════════════════════════════════════════════════════════

import random
import string

class SubscriptionTier(str):
    BASIC = "basic"
    PREMIUM = "premium"  # TrueNote

class KYCWebhookPayload(BaseModel):
    applicantId: str
    externalUserId: str
    type: str
    reviewResult: dict | None = None
    confidence: float | None = None


db_users: dict = {
    "user_123": {
        "user_id": "user_123",
        "nationality": "KR",
        "is_verified": False,      # 베이직 OTP 인증 완료 여부
        "is_truenote": False,      # 트루노트(프리미엄) 인증 완료 여부
        "subscription": "basic",   # "basic" | "premium"
        "is_banned": False,
        "device_fingerprint": None,
    }
}
audit_log: list = []

# OTP 임시 저장소 (실제 서비스: Redis + TTL)
otp_store: dict[str, dict] = {}  # { phone: { "otp": str, "expires_at": datetime } }


# ════════════════════════════════════════════════════════════
# SECTION 4: 웹훅 서명 검증 (이전 단계)
# ════════════════════════════════════════════════════════════

async def verify_sumsub_signature(request: Request) -> bytes:
    raw_body = await request.body()
    signature_header = request.headers.get("X-Payload-Digest")

    if not signature_header:
        logger.warning("웹훅 수신: 서명 헤더 없음 — 요청 거부")
        raise HTTPException(status_code=401, detail="Missing signature header")

    expected_signature = hmac.new(
        SUMSUB_SECRET_KEY.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected_signature, signature_header):
        logger.warning(f"웹훅 수신: 서명 불일치 — 위조 요청 의심")
        raise HTTPException(status_code=401, detail="Invalid signature")

    return raw_body


# ════════════════════════════════════════════════════════════
# SECTION 5: 엔드포인트
# ════════════════════════════════════════════════════════════

@app.post("/api/verification/start")
async def start_verification(
    body: DeviceRegistrationRequest,
    request: Request,
    _rate: None = Depends(rate_limit_kyc_start),          # 1) Rate limit 먼저
    fingerprint: str = Depends(check_device_not_banned),  # 2) 차단된 기기 확인
):
    """
    KYC 프로세스 시작 엔드포인트.
    - 차단된 기기는 진입 불가
    - IP당 1시간 3회 제한
    - 유저에 기기 지문을 연결
    """
    user = db_users.get(body.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user["is_banned"]:
        raise HTTPException(status_code=403, detail="This account has been suspended.")

    # 기기 지문을 유저에 연결 (1기기 1계정 추적용)
    db_users[body.user_id]["device_fingerprint"] = fingerprint
    logger.info(f"KYC 시작 — user_id={body.user_id}, device={fingerprint[:12]}...")

    return {
        "message": "KYC process initiated.",
        "user_id": body.user_id,
    }


@app.post("/api/verification/webhook")
async def kyc_webhook(
    payload: KYCWebhookPayload,
    _sig: bytes = Depends(verify_sumsub_signature),  # 1) 서명 검증
    _rate: None = Depends(rate_limit_webhook),        # 2) Rate limit
):
    """KYC 결과 수신 웹훅 (Sumsub → 서버)"""
    user_id = payload.externalUserId
    user = db_users.get(user_id)

    audit_log.append({
        "timestamp": datetime.utcnow().isoformat(),
        "user_id": user_id,
        "event_type": payload.type,
        "review_result": payload.reviewResult,
        "confidence": payload.confidence,
    })

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user["is_banned"]:
        return {"message": "User is already banned."}

    review_answer = (payload.reviewResult or {}).get("reviewAnswer", "")
    confidence = payload.confidence or 0.0
    reject_labels = (payload.reviewResult or {}).get("rejectLabels", [])

    is_approved = (
        payload.type == "applicantReviewed"
        and review_answer == "GREEN"
        and confidence >= KYC_CONFIDENCE_THRESHOLD
    )

    if is_approved:
        db_users[user_id]["is_verified"] = True
        logger.info(f"유저 인증 완료 — user_id={user_id}, confidence={confidence:.2f}")
        return {"message": "User successfully verified and activated."}

    else:
        db_users[user_id]["is_banned"] = True
        logger.warning(f"유저 인증 실패 → 즉시 차단 — user_id={user_id}, reason={reject_labels}")

        # ★ 핵심: 연결된 기기도 동시에 블랙리스트에 등록
        device_fp = user.get("device_fingerprint")
        if device_fp:
            device_blacklist.ban(
                fingerprint=device_fp,
                user_id=user_id,
                reason=f"KYC failed: {reject_labels}",
            )

        return {"message": "Verification failed. User suspended.", "reasons": reject_labels}


@app.post("/api/device/check")
async def check_device(body: DeviceCheckRequest):
    """
    프론트엔드에서 가입 전 기기 차단 여부를 사전 확인하는 엔드포인트.
    차단된 기기는 KYC 시작 전에 안내 메시지를 표시할 수 있습니다.
    """
    if device_blacklist.is_banned(body.device_fingerprint):
        return {"is_banned": True, "message": "이 기기는 서비스 이용이 불가합니다."}
    return {"is_banned": False}


@app.get("/health")
async def health():
    return {"status": "ok"}


# ════════════════════════════════════════════════════════════
# SECTION 6: 투트랙 인증 — Track 1 (베이직 OTP)
# ════════════════════════════════════════════════════════════

class OtpSendRequest(BaseModel):
    phone: str      # E.164 형식 (+821012345678)
    user_id: str

class OtpVerifyRequest(BaseModel):
    phone: str
    otp: str
    user_id: str


def _generate_otp(length: int = 6) -> str:
    return ''.join(random.choices(string.digits, k=length))


@app.post("/api/auth/otp/send")
async def send_otp(
    body: OtpSendRequest,
    request: Request,
    _rate: None = Depends(rate_limit_kyc_start),
    fingerprint: str = Depends(check_device_not_banned),
):
    """
    Track 1: 휴대폰 OTP 발송 (베이직 가입 첫 단계).

    실제 구현 시: Twilio Verify, SENS(NCP), 알리고 등 SMS 게이트웨이 연동.
    """
    otp = _generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=5)

    otp_store[body.phone] = {
        "otp": otp,
        "user_id": body.user_id,
        "expires_at": expires_at,
        "attempts": 0,
    }

    logger.info(f"OTP 발송 — phone={body.phone[-4:].rjust(len(body.phone), '*')}")
    # TODO: SMS 게이트웨이 호출 (Twilio 예시)
    # client.verify.v2.services(TWILIO_SERVICE_SID).verifications.create(to=body.phone, channel='sms')

    return {"message": "OTP sent.", "expires_in": 300}


@app.post("/api/auth/otp/verify")
async def verify_otp(body: OtpVerifyRequest):
    """
    Track 1: OTP 검증 → 베이직 인증 완료.

    OTP 5회 틀리면 해당 번호로 30분간 재시도 차단.
    """
    record = otp_store.get(body.phone)

    if not record:
        raise HTTPException(status_code=400, detail="OTP를 먼저 요청해 주세요.")

    # 만료 확인
    if datetime.utcnow() > record["expires_at"]:
        del otp_store[body.phone]
        raise HTTPException(status_code=400, detail="OTP가 만료되었습니다. 다시 요청해 주세요.")

    # 시도 횟수 제한 (브루트포스 방지)
    record["attempts"] += 1
    if record["attempts"] > 5:
        del otp_store[body.phone]
        logger.warning(f"OTP 브루트포스 의심 — phone=***{body.phone[-4:]}")
        raise HTTPException(status_code=429, detail="시도 횟수 초과. 30분 후 다시 요청해 주세요.")

    if record["otp"] != body.otp:
        raise HTTPException(
            status_code=400,
            detail=f"OTP가 올바르지 않습니다. ({5 - record['attempts']}회 남음)"
        )

    # 인증 성공
    del otp_store[body.phone]
    user_id = body.user_id
    if user_id not in db_users:
        db_users[user_id] = {
            "user_id": user_id,
            "nationality": None,
            "is_verified": True,       # 베이직 인증 완료
            "is_truenote": False,
            "subscription": "basic",
            "is_banned": False,
            "device_fingerprint": None,
        }
    else:
        db_users[user_id]["is_verified"] = True

    logger.info(f"베이직 OTP 인증 완료 — user_id={user_id}")
    return {"message": "Phone verified. Basic account activated.", "tier": "basic"}


# ════════════════════════════════════════════════════════════
# SECTION 7: 투트랙 인증 — Track 2 (트루노트 프리미엄)
# ════════════════════════════════════════════════════════════

class SubscriptionUpgradeRequest(BaseModel):
    user_id: str
    payment_intent_id: str   # Stripe PaymentIntent ID (결제 검증용)
    billing_cycle: str       # "monthly" | "yearly"


class TruenoteWebhookPayload(BaseModel):
    """
    트루노트 전용 KYC 웹훅:
    여권 + 직업/학력 증빙 + 3D 안면인식을 모두 통과해야 승인.
    """
    applicantId: str
    externalUserId: str
    type: str
    reviewResult: dict | None = None
    confidence: float | None = None
    employment_verified: bool = False   # 직업 증빙 통과 여부
    education_verified: bool = False    # 학력 증빙 통과 여부 (선택)
    liveness_3d_score: float = 0.0      # 3D 안면인식 점수 (0~1)


TRUENOTE_CONFIDENCE_THRESHOLD = float(os.getenv("TRUENOTE_CONFIDENCE_THRESHOLD", "0.98"))
TRUENOTE_LIVENESS_3D_THRESHOLD = float(os.getenv("TRUENOTE_LIVENESS_3D_THRESHOLD", "0.97"))


@app.post("/api/subscription/upgrade")
async def upgrade_to_premium(
    body: SubscriptionUpgradeRequest,
    request: Request,
    fingerprint: str = Depends(check_device_not_banned),
):
    """
    Track 2 Step 1: 결제 확인 후 트루노트 KYC 프로세스 시작.
    실제 구현 시 Stripe payment_intent_id를 서버에서 검증해야 합니다.
    """
    user = db_users.get(body.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.get("is_verified"):
        raise HTTPException(status_code=400, detail="베이직 인증을 먼저 완료해 주세요.")

    # TODO: Stripe API로 payment_intent_id 검증
    # stripe.PaymentIntent.retrieve(body.payment_intent_id)

    db_users[body.user_id]["subscription"] = "premium_pending"  # 결제 완료, KYC 심사 대기
    logger.info(f"프리미엄 업그레이드 결제 확인 — user_id={body.user_id}, cycle={body.billing_cycle}")

    return {
        "message": "Payment confirmed. TrueNote KYC process initiated.",
        "next_step": "passport_kyc",
    }


@app.post("/api/verification/truenote/webhook")
async def truenote_kyc_webhook(
    payload: TruenoteWebhookPayload,
    _sig: bytes = Depends(verify_sumsub_signature),
    _rate: None = Depends(rate_limit_webhook),
):
    """
    Track 2 Step 2: 트루노트 심사 결과 웹훅.

    베이직 KYC보다 엄격한 기준 적용:
    - 안면 일치율 0.98 이상
    - 3D Liveness 점수 0.97 이상
    - 직업 증빙 필수
    """
    user_id = payload.externalUserId
    user = db_users.get(user_id)

    audit_log.append({
        "timestamp": datetime.utcnow().isoformat(),
        "user_id": user_id,
        "event_type": f"truenote_{payload.type}",
        "review_result": payload.reviewResult,
        "confidence": payload.confidence,
        "liveness_3d_score": payload.liveness_3d_score,
        "employment_verified": payload.employment_verified,
    })

    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("subscription") != "premium_pending":
        raise HTTPException(status_code=400, detail="TrueNote upgrade not initiated.")

    review_answer = (payload.reviewResult or {}).get("reviewAnswer", "")
    confidence = payload.confidence or 0.0
    reject_labels = (payload.reviewResult or {}).get("rejectLabels", [])

    is_truenote_approved = (
        payload.type == "applicantReviewed"
        and review_answer == "GREEN"
        and confidence >= TRUENOTE_CONFIDENCE_THRESHOLD          # 0.98 이상
        and payload.liveness_3d_score >= TRUENOTE_LIVENESS_3D_THRESHOLD  # 3D 0.97 이상
        and payload.employment_verified                          # 직업 증빙 필수
    )

    if is_truenote_approved:
        db_users[user_id]["is_truenote"] = True
        db_users[user_id]["subscription"] = "premium"
        logger.info(
            f"트루노트 인증 완료 — user_id={user_id}, "
            f"confidence={confidence:.2f}, 3d={payload.liveness_3d_score:.2f}"
        )
        return {"message": "TrueNote verification approved. Premium badge granted.", "tier": "premium"}

    else:
        # 프리미엄 심사 실패: 계정 차단이 아닌 베이직으로 강등 (구독료 환불 처리 필요)
        db_users[user_id]["subscription"] = "basic"
        logger.warning(
            f"트루노트 심사 실패 — user_id={user_id}, reason={reject_labels}, "
            f"confidence={confidence:.2f}, 3d={payload.liveness_3d_score:.2f}, "
            f"employment={payload.employment_verified}"
        )
        # TODO: 결제 환불 트리거 (Stripe Refund API)
        return {
            "message": "TrueNote verification failed. Downgraded to basic. Refund initiated.",
            "reasons": reject_labels,
        }


@app.get("/api/users/{user_id}/subscription")
async def get_subscription_status(user_id: str):
    """유저의 현재 구독 및 인증 상태를 반환합니다."""
    user = db_users.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "user_id": user_id,
        "subscription": user.get("subscription", "basic"),
        "is_verified": user.get("is_verified", False),
        "is_truenote": user.get("is_truenote", False),
        "badge": "truenote" if user.get("is_truenote") else ("verified" if user.get("is_verified") else None),
    }


# ════════════════════════════════════════════════════════════
# SECTION 8: 채팅 & 외부 앱 감지 / 경고 시스템
# ════════════════════════════════════════════════════════════

import re
import uuid

# ── 외부 앱 감지 패턴 ────────────────────────────────────
# 한국어/일본어/중국어 표기 및 영문 모두 포함
EXTERNAL_APP_PATTERNS: list[tuple[str, str]] = [
    # (앱 이름, 정규식)
    ("KakaoTalk",  r"카카오톡?|카톡|kakao\s*talk|katalk|kakao\s*id"),
    ("LINE",       r"\bline\s*(id|아이디|계정)?\b|라인\s*(id|아이디|계정|으로|에서)|line@"),
    ("WhatsApp",   r"whats\s*app|왓츠\s*앱|wa\.me"),
    ("WeChat",     r"위챗|wechat|微信|weixin"),
    ("Instagram",  r"인스타(그램)?로\s*|인스타\s*(디엠|dm)|인스타\s*아이디|instagram\s*(dm|id|@)"),
    ("Telegram",   r"텔레그램|telegram\s*(id|@)?"),
    ("Twitter/X",  r"트위터|twitter\s*dm|트위터\s*디엠"),
    ("Snapchat",   r"스냅챗|snapchat"),
    # 전화번호 패턴 (한국 010, 일본 080/090/070, 대만 09xx)
    ("Phone",      r"(?<!\d)(0[1-9][0-9]\s*[-‐–]\s*\d{3,4}\s*[-‐–]\s*\d{4}|0[189][0-9]\s*[-‐–]\s*\d{4}\s*[-‐–]\s*\d{4}|09\d{2}\s*[-‐–]\s*\d{3}\s*[-‐–]\s*\d{3})(?!\d)"),
    # 소셜 핸들 (@뒤에 알파벳/숫자)
    ("SNS Handle", r"@[a-zA-Z0-9_.]{3,30}"),
]

MAX_WARNINGS = 2  # 이 횟수 도달 시 계정 즉시 삭제


def detect_external_app(text: str) -> tuple[bool, str | None]:
    """
    메시지에서 외부 앱 유도 패턴을 감지합니다.
    Returns: (감지됨: bool, 앱 이름: str | None)
    """
    lower = text.lower()
    for app_name, pattern in EXTERNAL_APP_PATTERNS:
        if re.search(pattern, lower, re.IGNORECASE):
            return True, app_name
    return False, None


# ── 인메모리 채팅 저장소 ─────────────────────────────────
# 실제 서비스: PostgreSQL + Redis Pub/Sub (WebSocket) 또는 Firebase Realtime DB
db_matches: dict[str, dict] = {
    "match_001": {
        "id": "match_001",
        "user_ids": ["user_123", "user_yuki"],
        "created_at": datetime.utcnow().isoformat(),
    }
}
db_messages: dict[str, list] = {
    "match_001": []
}
# 유저별 경고 카운터
warning_counts: dict[str, int] = {}
# 삭제된 계정 목록 (실제 서비스: DB 소프트 딜리트)
deleted_accounts: set[str] = set()


# ── 모델 ─────────────────────────────────────────────────
class SendMessageRequest(BaseModel):
    match_id: str
    sender_id: str
    content: str


class MessageResponse(BaseModel):
    id: str
    match_id: str
    sender_id: str
    content: str
    sent_at: str
    is_flagged: bool = False


# ── 엔드포인트 ───────────────────────────────────────────

@app.post("/api/chat/send")
async def send_message(body: SendMessageRequest):
    """
    메시지 전송.
    1. 외부 앱 유도 감지 → 경고 발행 및 메시지 차단
    2. 경고 2회 누적 → 즉시 계정 삭제
    """
    sender_id = body.sender_id

    # 삭제된 계정 확인
    if sender_id in deleted_accounts:
        raise HTTPException(status_code=403, detail="Account has been deleted.")

    # 매치 존재 확인
    match = db_matches.get(body.match_id)
    if not match or sender_id not in match["user_ids"]:
        raise HTTPException(status_code=404, detail="Match not found.")

    # ── 핵심: 외부 앱 유도 감지 ──────────────────────────
    is_flagged, detected_app = detect_external_app(body.content)

    if is_flagged:
        current_warnings = warning_counts.get(sender_id, 0) + 1
        warning_counts[sender_id] = current_warnings

        logger.warning(
            f"외부 앱 유도 감지 — user_id={sender_id}, app={detected_app}, "
            f"warning={current_warnings}/{MAX_WARNINGS}"
        )

        # 감사 로그
        audit_log.append({
            "timestamp": datetime.utcnow().isoformat(),
            "event_type": "external_app_detected",
            "user_id": sender_id,
            "detected_app": detected_app,
            "warning_count": current_warnings,
            "message_preview": body.content[:50],
        })

        # 경고 2회 도달 → 즉시 계정 삭제
        if current_warnings >= MAX_WARNINGS:
            deleted_accounts.add(sender_id)
            if sender_id in db_users:
                db_users[sender_id]["is_banned"] = True
                db_users[sender_id]["ban_reason"] = f"외부 앱 유도 {MAX_WARNINGS}회 적발 → 자동 삭제"
            # 기기도 블랙리스트 등록
            device_fp = db_users.get(sender_id, {}).get("device_fingerprint")
            if device_fp:
                device_blacklist.ban(device_fp, sender_id, "external_app_repeated")

            logger.warning(f"계정 자동 삭제 — user_id={sender_id} ({MAX_WARNINGS}회 경고 초과)")
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "ACCOUNT_DELETED",
                    "message": f"외부 메신저 유도 {MAX_WARNINGS}회 적발로 계정이 삭제되었습니다.",
                    "warning_count": current_warnings,
                },
            )

        # 메시지 차단 (상대방에게 전달 안 됨)
        raise HTTPException(
            status_code=400,
            detail={
                "code": "EXTERNAL_APP_WARNING",
                "message": f"'{detected_app}' 등 외부 메신저로의 유도는 금지되어 있습니다.",
                "warning_count": current_warnings,
                "max_warnings": MAX_WARNINGS,
                "remaining": MAX_WARNINGS - current_warnings,
            },
        )

    # ── 정상 메시지 저장 ─────────────────────────────────
    msg = {
        "id": str(uuid.uuid4()),
        "match_id": body.match_id,
        "sender_id": sender_id,
        "content": body.content,
        "sent_at": datetime.utcnow().isoformat(),
        "is_flagged": False,
    }
    if body.match_id not in db_messages:
        db_messages[body.match_id] = []
    db_messages[body.match_id].append(msg)

    return msg


@app.get("/api/chat/{match_id}/messages")
async def get_messages(match_id: str, user_id: str):
    """채팅방 메시지 목록 조회"""
    match = db_matches.get(match_id)
    if not match or user_id not in match["user_ids"]:
        raise HTTPException(status_code=404, detail="Match not found.")

    return {"messages": db_messages.get(match_id, [])}


@app.get("/api/matches/{user_id}")
async def get_matches(user_id: str):
    """유저의 매칭 목록 조회"""
    user_matches = [
        m for m in db_matches.values()
        if user_id in m["user_ids"]
    ]
    return {"matches": user_matches}


@app.get("/api/users/{user_id}/warnings")
async def get_warning_count(user_id: str):
    """유저의 현재 경고 횟수 조회"""
    return {
        "user_id": user_id,
        "warning_count": warning_counts.get(user_id, 0),
        "max_warnings": MAX_WARNINGS,
        "is_deleted": user_id in deleted_accounts,
    }
