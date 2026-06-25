"""
FCM (Firebase Cloud Messaging) 푸시 알림 발송 서비스 — HTTP v1 API
=====================================================================

환경변수 설정 (둘 중 하나):
  GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json  ← 파일 경로
  FCM_SERVICE_ACCOUNT_JSON='{...}'                               ← JSON 문자열 (Vercel 배포용)

사용법:
  from services.fcm import send_push

  await send_push(
      fcm_token="user-fcm-token",
      title="새로운 소개팅이 도착했어요!",
      body="큐레이터가 정성껏 고른 상대방이에요.",
      data={"type": "new_intro", "match_id": "..."},
  )
"""

from __future__ import annotations

import os
import json
import logging
import httpx

logger = logging.getLogger(__name__)

FCM_PROJECT_ID = os.getenv("FCM_PROJECT_ID", "rd-vibe")
FCM_V1_URL = f"https://fcm.googleapis.com/v1/projects/{FCM_PROJECT_ID}/messages:send"

_access_token_cache: dict = {"token": None, "expiry": 0}


def _get_access_token() -> str | None:
    """서비스 계정 JSON에서 OAuth2 액세스 토큰 발급."""
    import time
    now = time.time()
    if _access_token_cache["token"] and _access_token_cache["expiry"] > now + 60:
        return _access_token_cache["token"]

    try:
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request

        # 방법 1: JSON 문자열 환경변수 (Vercel/Railway 배포용)
        sa_json_str = os.getenv("FCM_SERVICE_ACCOUNT_JSON", "")
        # 방법 2: 파일 경로 환경변수
        sa_file = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")

        if sa_json_str:
            sa_info = json.loads(sa_json_str)
            creds = service_account.Credentials.from_service_account_info(
                sa_info,
                scopes=["https://www.googleapis.com/auth/firebase.messaging"],
            )
        elif sa_file and os.path.exists(sa_file):
            creds = service_account.Credentials.from_service_account_file(
                sa_file,
                scopes=["https://www.googleapis.com/auth/firebase.messaging"],
            )
        else:
            logger.warning("[FCM] 서비스 계정 미설정 (FCM_SERVICE_ACCOUNT_JSON 또는 GOOGLE_APPLICATION_CREDENTIALS 필요)")
            return None

        creds.refresh(Request())
        _access_token_cache["token"] = creds.token
        _access_token_cache["expiry"] = creds.expiry.timestamp() if creds.expiry else now + 3600
        return creds.token

    except ImportError:
        logger.error("[FCM] google-auth 패키지 미설치 — pip install google-auth 필요")
        return None
    except Exception as e:
        logger.error(f"[FCM] 액세스 토큰 발급 오류: {e}")
        return None


async def send_push(
    fcm_token: str,
    title: str,
    body: str,
    data: dict | None = None,
) -> bool:
    """
    단일 FCM 토큰에 푸시 알림 발송 (FCM HTTP v1 API).
    반환값: 성공 여부 (실패해도 예외 발생 안 함)
    """
    if not fcm_token:
        return False

    access_token = _get_access_token()
    if not access_token:
        return False

    # data 값은 모두 문자열이어야 함
    str_data = {k: str(v) for k, v in (data or {}).items()}

    payload = {
        "message": {
            "token": fcm_token,
            "notification": {
                "title": title,
                "body":  body,
            },
            "data": str_data,
            "android": {
                "priority": "high",
                "notification": {
                    "sound": "default",
                    "icon":  "ic_stat_notification",
                },
            },
            "apns": {
                "payload": {
                    "aps": {
                        "sound": "default",
                        "badge": 1,
                    }
                }
            },
            "webpush": {
                "notification": {
                    "icon": "/icon-192x192.png",
                },
            },
        }
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.post(
                FCM_V1_URL,
                json=payload,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type":  "application/json",
                },
            )
        if res.status_code == 200:
            logger.info(f"[FCM] 발송 성공: {fcm_token[:20]}...")
            return True
        else:
            logger.warning(f"[FCM] 발송 실패 ({res.status_code}): {res.text[:200]}")
            # 토큰 만료 시 캐시 초기화
            if res.status_code == 401:
                _access_token_cache["token"] = None
            return False
    except Exception as e:
        logger.error(f"[FCM] 발송 오류: {e}")
        return False


async def send_push_to_user(
    db,
    user_id: str,
    title: str,
    body: str,
    data: dict | None = None,
) -> bool:
    """
    user_id로 FCM 토큰 조회 후 발송.
    """
    try:
        row = db.table("users").select("fcm_token").eq("id", user_id).maybe_single().execute()
        if not row.data or not row.data.get("fcm_token"):
            return False
        return await send_push(row.data["fcm_token"], title, body, data)
    except Exception as e:
        logger.error(f"[FCM] send_push_to_user 오류 (user={user_id}): {e}")
        return False
