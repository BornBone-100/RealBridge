"""
웹훅 서명 검증 단위 테스트

실행 방법:
  pip install pytest httpx fastapi python-dotenv --break-system-packages
  SUMSUB_SECRET_KEY=test_secret pytest test_webhook_signature.py -v
"""
import hmac
import hashlib
import json
import os

import pytest
from fastapi.testclient import TestClient

os.environ["SUMSUB_SECRET_KEY"] = "test_secret_key"

from main import app

client = TestClient(app, raise_server_exceptions=False)

SECRET = "test_secret_key"

VALID_PAYLOAD = {
    "applicantId": "sumsub_app_abc123",
    "externalUserId": "user_123",
    "type": "applicantReviewed",
    "reviewResult": {"reviewAnswer": "GREEN"},
    "confidence": 0.97,
}


def make_signature(body: bytes, secret: str = SECRET) -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def post_webhook(payload: dict, signature: str | None = "auto") -> dict:
    body = json.dumps(payload).encode()
    headers = {}
    if signature == "auto":
        headers["X-Payload-Digest"] = make_signature(body)
    elif signature is not None:
        headers["X-Payload-Digest"] = signature

    response = client.post(
        "/api/verification/webhook",
        content=body,
        headers={"Content-Type": "application/json", **headers},
    )
    return response


# ── 정상 케이스 ──────────────────────────────────────────
class TestValidSignature:
    def test_approved_user_gets_verified(self):
        """정상 서명 + GREEN 결과 → 유저 인증 완료"""
        r = post_webhook(VALID_PAYLOAD)
        assert r.status_code == 200
        assert "verified" in r.json()["message"].lower()

    def test_rejected_user_gets_banned(self):
        """정상 서명 + RED 결과 → 유저 차단"""
        payload = {**VALID_PAYLOAD, "reviewResult": {"reviewAnswer": "RED", "rejectLabels": ["FORGERY"]}, "confidence": 0.60}
        r = post_webhook(payload)
        assert r.status_code == 200
        assert "suspended" in r.json()["message"].lower()

    def test_low_confidence_gets_banned(self):
        """신뢰도 0.95 미만 → 차단 (얼굴 불일치)"""
        payload = {**VALID_PAYLOAD, "confidence": 0.80}
        # 앞 테스트에서 user_123이 이미 verified되었을 수 있어 새 유저로 테스트
        from main import db_users
        db_users["user_456"] = {"user_id": "user_456", "nationality": "JP", "is_verified": False, "is_banned": False}
        payload = {**payload, "externalUserId": "user_456"}
        r = post_webhook(payload)
        assert r.status_code == 200
        assert "suspended" in r.json()["message"].lower()


# ── 서명 위조 케이스 ─────────────────────────────────────
class TestSignatureSecurity:
    def test_missing_signature_header_returns_401(self):
        """서명 헤더 없음 → 401"""
        r = post_webhook(VALID_PAYLOAD, signature=None)
        assert r.status_code == 401
        assert "Missing signature" in r.json()["detail"]

    def test_wrong_signature_returns_401(self):
        """위조된 서명 → 401"""
        r = post_webhook(VALID_PAYLOAD, signature="deadbeefdeadbeef")
        assert r.status_code == 401
        assert "Invalid signature" in r.json()["detail"]

    def test_tampered_body_returns_401(self):
        """서명은 맞지만 바디를 조작한 경우 → 401 (서명 불일치)"""
        body = json.dumps(VALID_PAYLOAD).encode()
        real_sig = make_signature(body)

        # 바디만 조작
        tampered_body = json.dumps({**VALID_PAYLOAD, "confidence": 0.99}).encode()

        response = client.post(
            "/api/verification/webhook",
            content=tampered_body,
            headers={
                "Content-Type": "application/json",
                "X-Payload-Digest": real_sig,  # 원본 서명 그대로
            },
        )
        assert response.status_code == 401

    def test_wrong_secret_returns_401(self):
        """다른 시크릿 키로 서명한 경우 → 401"""
        r = post_webhook(VALID_PAYLOAD, signature=make_signature(json.dumps(VALID_PAYLOAD).encode(), secret="wrong_secret"))
        assert r.status_code == 401

    def test_nonexistent_user_returns_404(self):
        """존재하지 않는 user_id → 404"""
        payload = {**VALID_PAYLOAD, "externalUserId": "ghost_user"}
        r = post_webhook(payload)
        assert r.status_code == 404
