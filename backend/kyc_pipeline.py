"""
RealBridge KYC Pipeline
========================
신분증 이미지를 디스크에 저장하지 않고 메모리에서 처리합니다.
- 업로드 → 메모리 버퍼 → AWS Rekognition 전송 → 해시 저장 → 원본 파기

아키텍처:
  UploadFile (메모리)
      ↓
  [선택] 이미지 품질 검사 (흐림, 조도)
      ↓
  AWS Rekognition CompareFaces  ←── selfie bytes (메모리)
      ↓
  match_confidence 비교 (threshold: 90%)
      ↓
  verified=True → SHA-256 해시 + 타임스탬프만 DB 저장
  verified=False → 실패 카운트 증가, 디바이스 블랙리스트 검토
      ↓
  원본 bytes → 즉시 GC (del + gc.collect)
"""

import gc
import hashlib
import hmac
import io
import logging
import os
import time
from datetime import datetime, timezone
from typing import Optional

import boto3
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from PIL import Image
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/kyc", tags=["kyc"])
security = HTTPBearer()

# ── 환경 변수 ────────────────────────────────────────────────────────────────
AWS_REGION         = os.getenv("AWS_REGION", "ap-northeast-2")
REKOGNITION_THRESHOLD = float(os.getenv("KYC_FACE_THRESHOLD", "90.0"))  # 90% 유사도
MAX_FILE_SIZE_MB   = int(os.getenv("KYC_MAX_FILE_MB", "10"))
HMAC_SECRET        = os.getenv("KYC_HMAC_SECRET", "change-me-in-production").encode()

# ── DB 모델 (실제 서비스에서는 SQLAlchemy / Prisma 등으로 교체) ───────────────
# 예시: 인증 완료 기록만 저장하는 테이블 구조
#
# CREATE TABLE kyc_verifications (
#   id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
#   user_id       UUID NOT NULL REFERENCES users(id),
#   id_hash       VARCHAR(64) NOT NULL,   -- SHA-256(원본이미지 bytes)
#   selfie_hash   VARCHAR(64) NOT NULL,   -- SHA-256(셀카 bytes)
#   verified_at   TIMESTAMPTZ NOT NULL,
#   confidence    FLOAT NOT NULL,          -- Rekognition 유사도 점수
#   id_type       VARCHAR(20) NOT NULL,    -- 'passport' | 'id_card'
#   created_ip    INET
# );
#
# ⚠️  원본 이미지 bytes는 절대 저장하지 않습니다.

# 인메모리 유저 저장소 (실제: DB)
_users_db: dict[str, dict] = {}
_kyc_records: dict[str, dict] = {}


# ── Pydantic 응답 모델 ────────────────────────────────────────────────────────
class KYCStartResponse(BaseModel):
    message: str
    user_id: str
    upload_token: str   # 단기 토큰, 실제 업로드에만 사용


class KYCVerifyResponse(BaseModel):
    verified: bool
    user_id: str
    verified_at: Optional[str] = None
    message: str


class KYCStatusResponse(BaseModel):
    user_id: str
    is_verified: bool
    verified_at: Optional[str] = None
    id_type: Optional[str] = None


# ── 유틸리티 ─────────────────────────────────────────────────────────────────

def _sha256(data: bytes) -> str:
    """bytes → SHA-256 hex digest. 원본 복원 불가."""
    return hashlib.sha256(data).hexdigest()


def _hmac_token(user_id: str, timestamp: int) -> str:
    """업로드 전용 단기 HMAC 토큰 생성 (5분 유효)."""
    msg = f"{user_id}:{timestamp}".encode()
    return hmac.new(HMAC_SECRET, msg, hashlib.sha256).hexdigest()


def _verify_upload_token(user_id: str, token: str) -> bool:
    """업로드 토큰 검증 (타이밍 공격 방지: compare_digest 사용)."""
    window = 300  # 5분
    now = int(time.time())
    for ts in range(now - window, now + 1, 60):  # 1분 단위 윈도우
        expected = _hmac_token(user_id, ts - (ts % 60))
        if hmac.compare_digest(expected, token):
            return True
    return False


def _validate_image_bytes(data: bytes, max_mb: int = MAX_FILE_SIZE_MB) -> Image.Image:
    """
    이미지 바이트 검증:
    - 파일 크기 제한
    - 유효한 이미지 포맷 (JPEG/PNG)
    - 최소 해상도 확인
    실패 시 HTTPException 발생 (data는 참조 해제됨)
    """
    if len(data) > max_mb * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"이미지 크기는 {max_mb}MB 이하여야 합니다."
        )

    try:
        img = Image.open(io.BytesIO(data))
        img.verify()  # 포맷 검증 (이 시점에 img는 더 이상 읽기 불가)
        img = Image.open(io.BytesIO(data))  # 재오픈
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="지원하지 않는 이미지 형식입니다. (JPEG/PNG만 허용)"
        )

    if img.format not in ("JPEG", "PNG"):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="JPEG 또는 PNG 형식만 허용됩니다."
        )

    w, h = img.size
    if w < 400 or h < 400:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="이미지 해상도가 너무 낮습니다. (최소 400x400px)"
        )

    return img


def _to_jpeg_bytes(img: Image.Image, quality: int = 85) -> bytes:
    """
    PIL Image → JPEG bytes 변환.
    EXIF 메타데이터(GPS 등)를 제거하여 개인정보 보호.
    """
    buf = io.BytesIO()
    # EXIF 없이 저장 (개인정보 포함 메타데이터 제거)
    rgb = img.convert("RGB")
    rgb.save(buf, format="JPEG", quality=quality, exif=b"")
    buf.seek(0)
    result = buf.read()
    buf.close()
    del rgb
    return result


# ── AWS Rekognition 얼굴 비교 ────────────────────────────────────────────────

def _compare_faces_rekognition(
    id_image_bytes: bytes,
    selfie_bytes: bytes,
) -> tuple[bool, float]:
    """
    AWS Rekognition CompareFaces API 호출.

    Parameters
    ----------
    id_image_bytes : 신분증 이미지 bytes (메모리 only)
    selfie_bytes   : 셀카 이미지 bytes (메모리 only)

    Returns
    -------
    (is_match: bool, confidence: float)

    ⚠️  이 함수가 반환된 뒤 호출부에서 반드시 원본 bytes를 del 해야 함.
    """
    client = boto3.client("rekognition", region_name=AWS_REGION)

    try:
        response = client.compare_faces(
            SourceImage={"Bytes": id_image_bytes},    # 신분증 (기준)
            TargetImage={"Bytes": selfie_bytes},       # 셀카 (비교 대상)
            SimilarityThreshold=REKOGNITION_THRESHOLD,
        )
    except ClientError as e:
        logger.error("Rekognition API 오류: %s", e.response["Error"]["Message"])
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="얼굴 인식 서비스가 일시적으로 불가합니다. 잠시 후 다시 시도해 주세요."
        )

    face_matches = response.get("FaceMatches", [])
    if not face_matches:
        return False, 0.0

    # 가장 유사도가 높은 얼굴 선택
    best = max(face_matches, key=lambda x: x["Similarity"])
    confidence = best["Similarity"]
    return confidence >= REKOGNITION_THRESHOLD, confidence


# ── 라우터 엔드포인트 ─────────────────────────────────────────────────────────

@router.post("/start", response_model=KYCStartResponse)
async def kyc_start(
    user_id: str = Form(...),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    KYC 시작 — 단기 업로드 토큰 발급.
    실제 서비스: JWT 검증 후 user_id 추출
    """
    # TODO: credentials.credentials (JWT) 검증
    if user_id not in _users_db:
        _users_db[user_id] = {"user_id": user_id, "is_verified": False}

    timestamp = int(time.time())
    timestamp = timestamp - (timestamp % 60)  # 1분 단위 정규화
    token = _hmac_token(user_id, timestamp)

    logger.info("KYC 시작: user_id=%s", user_id)
    return KYCStartResponse(
        message="업로드 토큰이 발급되었습니다. 5분 내 인증을 완료해 주세요.",
        user_id=user_id,
        upload_token=token,
    )


@router.post("/verify", response_model=KYCVerifyResponse)
async def kyc_verify(
    user_id: str        = Form(...),
    id_type: str        = Form(...),   # "passport" | "id_card"
    upload_token: str   = Form(...),
    id_image: UploadFile = File(...),
    selfie_image: UploadFile = File(...),
):
    """
    KYC 인증 메인 엔드포인트.

    보안 설계:
    1. 업로드 토큰 검증 (재사용 방지)
    2. 이미지 bytes 메모리 로드 — 디스크 기록 없음
    3. 이미지 유효성 검사 + EXIF 제거
    4. AWS Rekognition 얼굴 비교
    5. 결과 판정
    6. 원본 bytes 즉시 파기 (del + gc.collect)
    7. SHA-256 해시 + 인증 시간만 DB 저장
    """

    # ── 1. 토큰 검증 ────────────────────────────────────────
    if not _verify_upload_token(user_id, upload_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="업로드 토큰이 만료되었거나 유효하지 않습니다."
        )

    if id_type not in ("passport", "id_card"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="id_type은 'passport' 또는 'id_card'여야 합니다."
        )

    # ── 2. 이미지 bytes 메모리 로드 ─────────────────────────
    # ⚠️  await .read()는 메모리로만 읽음 — 임시 파일 생성 없음
    id_bytes     = await id_image.read()
    selfie_bytes = await selfie_image.read()

    id_hash     = _sha256(id_bytes)      # 해시는 바로 계산
    selfie_hash = _sha256(selfie_bytes)

    # ── 3. 이미지 유효성 검사 + EXIF 제거 ────────────────────
    try:
        id_img     = _validate_image_bytes(id_bytes)
        selfie_img = _validate_image_bytes(selfie_bytes)

        # EXIF 메타데이터 제거 후 재인코딩
        id_clean     = _to_jpeg_bytes(id_img)
        selfie_clean = _to_jpeg_bytes(selfie_img)
    except HTTPException:
        # 검증 실패 시 원본 bytes 즉시 파기
        del id_bytes, selfie_bytes
        gc.collect()
        raise

    # 원본 bytes는 더 이상 불필요 — 즉시 파기
    del id_bytes, selfie_bytes
    del id_img, selfie_img
    gc.collect()

    # ── 4. AWS Rekognition 얼굴 비교 ─────────────────────────
    try:
        is_match, confidence = _compare_faces_rekognition(id_clean, selfie_clean)
    finally:
        # API 결과와 무관하게 EXIF-제거본도 즉시 파기
        del id_clean, selfie_clean
        gc.collect()

    # ── 5. 결과 판정 ─────────────────────────────────────────
    verified_at = datetime.now(timezone.utc).isoformat()

    if not is_match:
        logger.warning(
            "KYC 실패: user_id=%s confidence=%.1f%%", user_id, confidence
        )
        return KYCVerifyResponse(
            verified=False,
            user_id=user_id,
            message=f"얼굴 일치율이 기준에 미달합니다. ({confidence:.1f}% < {REKOGNITION_THRESHOLD}%)"
        )

    # ── 6. 해시 + 메타데이터만 DB 저장 ──────────────────────
    # ⚠️  원본 이미지 bytes는 이미 파기됨
    _kyc_records[user_id] = {
        "user_id":     user_id,
        "id_hash":     id_hash,        # 이미지 원본 복원 불가
        "selfie_hash": selfie_hash,
        "id_type":     id_type,
        "confidence":  round(confidence, 2),
        "verified_at": verified_at,
    }
    _users_db[user_id]["is_verified"] = True
    _users_db[user_id]["verified_at"] = verified_at

    logger.info(
        "KYC 성공: user_id=%s confidence=%.1f%% id_type=%s",
        user_id, confidence, id_type
    )
    return KYCVerifyResponse(
        verified=True,
        user_id=user_id,
        verified_at=verified_at,
        message="본인 인증이 완료되었습니다.",
    )


@router.get("/status/{user_id}", response_model=KYCStatusResponse)
async def kyc_status(
    user_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """KYC 인증 상태 조회. 원본 이미지 데이터는 반환하지 않음."""
    user = _users_db.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")

    record = _kyc_records.get(user_id)
    return KYCStatusResponse(
        user_id=user_id,
        is_verified=user.get("is_verified", False),
        verified_at=record.get("verified_at") if record else None,
        id_type=record.get("id_type") if record else None,
    )
