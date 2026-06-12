"""
Rate Limiting & Device Fingerprint 블랙리스트 단위 테스트

실행 방법:
  SUMSUB_SECRET_KEY=test_secret pytest test_rate_limit_and_device.py -v
"""
import json
import hmac
import hashlib
import os
from datetime import datetime, timedelta

import pytest

os.environ["SUMSUB_SECRET_KEY"] = "test_secret_key"
os.environ["RATE_LIMIT_KYC_START"] = "3"
os.environ["RATE_LIMIT_KYC_WINDOW"] = "3600"
os.environ["RATE_LIMIT_WEBHOOK"] = "5"
os.environ["RATE_LIMIT_WEBHOOK_WINDOW"] = "60"

from main import app, rate_limiter, device_blacklist, db_users
from fastapi.testclient import TestClient

client = TestClient(app, raise_server_exceptions=False)
SECRET = "test_secret_key"

DEVICE_FP = "device_fp_test_abc123"
BANNED_DEVICE_FP = "device_fp_banned_xyz"


def make_sig(body: bytes) -> str:
    return hmac.new(SECRET.encode(), body, hashlib.sha256).hexdigest()


def post_webhook(payload: dict) -> object:
    body = json.dumps(payload).encode()
    return client.post(
        "/api/verification/webhook",
        content=body,
        headers={"Content-Type": "application/json", "X-Payload-Digest": make_sig(body)},
    )


# ── Rate Limiter 단위 테스트 ─────────────────────────────
class TestRateLimiter:
    def setup_method(self):
        """각 테스트 전 Rate Limiter 상태 초기화"""
        rate_limiter._requests.clear()

    def test_allows_requests_within_limit(self):
        """제한 내 요청은 모두 허용"""
        for _ in range(3):
            allowed, _ = rate_limiter.is_allowed("test_ip", max_requests=3, window_seconds=60)
            assert allowed

    def test_blocks_request_over_limit(self):
        """제한 초과 시 차단"""
        for _ in range(3):
            rate_limiter.is_allowed("test_ip", max_requests=3, window_seconds=60)

        allowed, retry_after = rate_limiter.is_allowed("test_ip", max_requests=3, window_seconds=60)
        assert not allowed
        assert retry_after > 0

    def test_different_keys_are_independent(self):
        """서로 다른 IP는 독립적으로 카운트"""
        for _ in range(3):
            rate_limiter.is_allowed("ip_a", max_requests=3, window_seconds=60)

        allowed_a, _ = rate_limiter.is_allowed("ip_a", max_requests=3, window_seconds=60)
        allowed_b, _ = rate_limiter.is_allowed("ip_b", max_requests=3, window_seconds=60)

        assert not allowed_a
        assert allowed_b

    def test_kyc_start_rate_limit_via_endpoint(self):
        """KYC 시작 엔드포인트: 3회 초과 시 429 반환"""
        # 기기 차단 X, 유저 존재
        db_users["user_rate_test"] = {
            "user_id": "user_rate_test", "nationality": "KR",
            "is_verified": False, "is_banned": False, "device_fingerprint": None,
        }

        for i in range(3):
            r = client.post(
                "/api/verification/start",
                json={"user_id": "user_rate_test", "device_fingerprint": DEVICE_FP},
                headers={"X-Device-Fingerprint": DEVICE_FP},
            )
            assert r.status_code == 200, f"요청 {i+1}번 실패: {r.status_code}"

        # 4번째 요청 → 429
        r = client.post(
            "/api/verification/start",
            json={"user_id": "user_rate_test", "device_fingerprint": DEVICE_FP},
            headers={"X-Device-Fingerprint": DEVICE_FP},
        )
        assert r.status_code == 429
        assert "Retry-After" in r.headers


# ── Device Fingerprint 블랙리스트 테스트 ─────────────────
class TestDeviceBlacklist:
    def setup_method(self):
        rate_limiter._requests.clear()
        device_blacklist._blacklist.clear()
        db_users["user_device_test"] = {
            "user_id": "user_device_test", "nationality": "JP",
            "is_verified": False, "is_banned": False, "device_fingerprint": None,
        }

    def test_banned_device_cannot_start_kyc(self):
        """차단된 기기 → KYC 시작 시 403"""
        device_blacklist.ban(BANNED_DEVICE_FP, "some_user", "KYC failed")

        r = client.post(
            "/api/verification/start",
            json={"user_id": "user_device_test", "device_fingerprint": BANNED_DEVICE_FP},
            headers={"X-Device-Fingerprint": BANNED_DEVICE_FP},
        )
        assert r.status_code == 403
        assert "차단" in r.json()["detail"]

    def test_kyc_failure_bans_device(self):
        """KYC 실패 시 유저 계정 + 연결된 기기가 모두 차단됨"""
        # 먼저 KYC 시작으로 기기 지문을 유저에 연결
        db_users["user_device_test"]["device_fingerprint"] = DEVICE_FP

        payload = {
            "applicantId": "app_001",
            "externalUserId": "user_device_test",
            "type": "applicantReviewed",
            "reviewResult": {"reviewAnswer": "RED", "rejectLabels": ["FORGERY"]},
            "confidence": 0.40,
        }
        r = post_webhook(payload)
        assert r.status_code == 200
        assert "suspended" in r.json()["message"].lower()

        # 유저 차단 확인
        assert db_users["user_device_test"]["is_banned"] is True

        # 기기도 블랙리스트에 등록됐는지 확인
        assert device_blacklist.is_banned(DEVICE_FP)

    def test_device_check_endpoint(self):
        """사전 확인 엔드포인트: 차단/비차단 응답 정확성"""
        device_blacklist.ban(BANNED_DEVICE_FP, "bad_user", "test")

        r_banned = client.post("/api/device/check", json={"device_fingerprint": BANNED_DEVICE_FP})
        assert r_banned.json()["is_banned"] is True

        r_clean = client.post("/api/device/check", json={"device_fingerprint": "clean_device_fp"})
        assert r_clean.json()["is_banned"] is False

    def test_missing_fingerprint_header_returns_400(self):
        """기기 지문 헤더 없이 KYC 시작 → 400"""
        r = client.post(
            "/api/verification/start",
            json={"user_id": "user_device_test", "device_fingerprint": ""},
            # X-Device-Fingerprint 헤더 없음
        )
        assert r.status_code == 400
