"""
RealBridge — Supabase 데이터베이스 클라이언트
===============================================

사용법:
    from database import db, get_db

    # 일반 쿼리
    result = await db.table("users").select("*").eq("id", user_id).execute()

    # FastAPI 의존성 주입
    async def my_endpoint(supabase = Depends(get_db)):
        ...
"""

import os
from functools import lru_cache

from supabase import create_client, Client
from supabase.lib.client_options import ClientOptions

# ── 환경 변수 ──────────────────────────────────────────────────
SUPABASE_URL      = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


# ── 클라이언트 팩토리 ──────────────────────────────────────────
@lru_cache(maxsize=1)
def _make_anon_client() -> Client:
    """
    anon 클라이언트 — RLS 적용, 일반 유저 권한.
    프론트엔드에서 전달된 JWT로 auth.uid() 작동.
    """
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise RuntimeError(
            "SUPABASE_URL 또는 SUPABASE_ANON_KEY 환경 변수가 설정되지 않았습니다."
        )
    return create_client(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        options=ClientOptions(auto_refresh_token=False),
    )


@lru_cache(maxsize=1)
def _make_service_client() -> Client:
    """
    service_role 클라이언트 — RLS 우회, 어드민 전용.
    절대 프론트엔드에 노출하지 말 것.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise RuntimeError(
            "SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경 변수가 설정되지 않았습니다."
        )
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


# ── 공개 인스턴스 ──────────────────────────────────────────────
db: Client       = None   # 앱 시작 시 init_db()로 초기화
admin_db: Client = None


def init_db():
    """FastAPI lifespan에서 호출."""
    global db, admin_db
    db       = _make_anon_client()
    admin_db = _make_service_client()


# ── FastAPI 의존성 ─────────────────────────────────────────────
def get_db() -> Client:
    """일반 엔드포인트용 — RLS 적용."""
    return db


def get_admin_db() -> Client:
    """어드민 엔드포인트용 — RLS 우회. 반드시 admin 권한 검증 후 사용."""
    return admin_db


# ── 헬퍼: JWT에서 user_id 추출 ────────────────────────────────
def get_user_id_from_token(token: str) -> str | None:
    """
    Bearer 토큰에서 Supabase user_id(UUID) 추출.
    실제 서명 검증은 Supabase Auth가 처리.
    """
    try:
        import base64, json
        payload_b64 = token.split(".")[1]
        # base64 패딩 보정
        payload_b64 += "=" * (4 - len(payload_b64) % 4)
        payload = json.loads(base64.b64decode(payload_b64))
        return payload.get("sub")
    except Exception:
        return None
