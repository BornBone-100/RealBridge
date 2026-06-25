"""
RealBridge — 가치관 기반 매칭 시스템
========================================

아키텍처 설계
-------------
DB 스키마 (PostgreSQL):

  ┌─────────────────────────────────────────────────────────────┐
  │  rich_profiles                                              │
  ├─────────────────────────────────────────────────────────────┤
  │  user_id          UUID PK → users.id                       │
  │  voice_intro_url  TEXT NULL        -- S3 presigned URL      │
  │  voice_duration_s SMALLINT NULL    -- 초 단위 (최대 90초)   │
  │  dating_values    TEXT NOT NULL    -- 연애관 서술문          │
  │  updated_at       TIMESTAMPTZ                               │
  └─────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────┐
  │  lifestyle_tags  (마스터 테이블)                            │
  ├─────────────────────────────────────────────────────────────┤
  │  id       SERIAL PK                                         │
  │  category VARCHAR(30)   -- 'contact' | 'weekend' | ...     │
  │  label_ko VARCHAR(30)                                       │
  │  label_ja VARCHAR(30)                                       │
  │  label_zh VARCHAR(30)                                       │
  │  weight   FLOAT DEFAULT 1.0  -- 매칭 가중치                 │
  └─────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────┐
  │  user_lifestyle_tags  (N:M)                                 │
  ├─────────────────────────────────────────────────────────────┤
  │  user_id  UUID FK                                           │
  │  tag_id   INT FK                                            │
  │  PRIMARY KEY (user_id, tag_id)                              │
  └─────────────────────────────────────────────────────────────┘

MatchScore 계산 공식
--------------------
  기본 점수 = (공통 태그 가중치 합 / 두 유저 태그 가중치 합의 최대값) × 100

  가중치 카테고리별 배율:
    연락 빈도    (contact)   × 2.0  ← 가장 큰 불일치 요인
    주말 성향    (weekend)   × 1.8
    미래 계획    (future)    × 1.8
    가치관       (values)    × 1.5
    라이프스타일 (lifestyle) × 1.2
    취미         (hobby)     × 1.0
"""

import math
from enum import Enum
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, field_validator

from database import get_admin_db

router = APIRouter(prefix="/api/matching", tags=["matching"])

ACTIVE_MATCH_STATES = ("waiting", "active")


# ── 태그 카테고리 ─────────────────────────────────────────────
class TagCategory(str, Enum):
    CONTACT   = "contact"    # 연락 빈도
    WEEKEND   = "weekend"    # 주말 성향
    FUTURE    = "future"     # 미래 계획
    VALUES    = "values"     # 가치관
    LIFESTYLE = "lifestyle"  # 라이프스타일
    HOBBY     = "hobby"      # 취미


# 카테고리별 가중치 배율
CATEGORY_WEIGHTS: dict[TagCategory, float] = {
    TagCategory.CONTACT:   2.0,
    TagCategory.WEEKEND:   1.8,
    TagCategory.FUTURE:    1.8,
    TagCategory.VALUES:    1.5,
    TagCategory.LIFESTYLE: 1.2,
    TagCategory.HOBBY:     1.0,
}


# ── 라이프스타일 태그 마스터 데이터 ──────────────────────────
# 실제 서비스: DB lifestyle_tags 테이블에서 조회
LIFESTYLE_TAGS: list[dict] = [
    # 연락 빈도
    {"id": "c1", "category": TagCategory.CONTACT,   "label_ko": "연락은 자주 📱",       "label_ja": "こまめに連絡 📱",    "label_zh": "常常聯絡 📱"},
    {"id": "c2", "category": TagCategory.CONTACT,   "label_ko": "하루 한 번이면 충분",   "label_ja": "1日1回で十分",      "label_zh": "一天一次就好"},
    {"id": "c3", "category": TagCategory.CONTACT,   "label_ko": "바쁘면 연락 줄어도 OK", "label_ja": "忙しいときはOK",    "label_zh": "忙時少聯絡也沒關係"},
    # 주말 성향
    {"id": "w1", "category": TagCategory.WEEKEND,   "label_ko": "주말엔 밖으로 🏃",      "label_ja": "週末は外へ 🏃",     "label_zh": "週末愛出門 🏃"},
    {"id": "w2", "category": TagCategory.WEEKEND,   "label_ko": "집에서 쉬는 게 최고",   "label_ja": "家でのんびり派",    "label_zh": "週末宅家最棒"},
    {"id": "w3", "category": TagCategory.WEEKEND,   "label_ko": "반반 섞어서",            "label_ja": "半々が好き",        "label_zh": "外出宅家各半"},
    # 미래 계획
    {"id": "f1", "category": TagCategory.FUTURE,    "label_ko": "결혼 생각 있어요 💍",   "label_ja": "結婚も考えてます",  "label_zh": "有結婚打算 💍"},
    {"id": "f2", "category": TagCategory.FUTURE,    "label_ko": "지금은 천천히 알아가요", "label_ja": "ゆっくり知りたい", "label_zh": "慢慢了解彼此"},
    {"id": "f3", "category": TagCategory.FUTURE,    "label_ko": "장거리 OK",             "label_ja": "遠距離OK",          "label_zh": "遠距離OK"},
    {"id": "f4", "category": TagCategory.FUTURE,    "label_ko": "언젠간 같은 나라에",    "label_ja": "いつか同じ国で",   "label_zh": "希望有天同個國家"},
    # 가치관
    {"id": "v1", "category": TagCategory.VALUES,    "label_ko": "솔직함이 제일 중요해요", "label_ja": "正直さが一番",     "label_zh": "誠實最重要"},
    {"id": "v2", "category": TagCategory.VALUES,    "label_ko": "서로의 공간 존중",       "label_ja": "お互いの空間を尊重", "label_zh": "尊重彼此空間"},
    {"id": "v3", "category": TagCategory.VALUES,    "label_ko": "감정 표현에 솔직해요",   "label_ja": "感情表現が得意",   "label_zh": "擅長表達感情"},
    {"id": "v4", "category": TagCategory.VALUES,    "label_ko": "다름을 즐겨요",          "label_ja": "違いを楽しむ",     "label_zh": "享受差異"},
    # 라이프스타일
    {"id": "l1", "category": TagCategory.LIFESTYLE, "label_ko": "아침형 인간 ☀️",        "label_ja": "朝型人間 ☀️",      "label_zh": "早起的鳥兒 ☀️"},
    {"id": "l2", "category": TagCategory.LIFESTYLE, "label_ko": "저녁형 인간 🌙",        "label_ja": "夜型人間 🌙",      "label_zh": "夜貓子 🌙"},
    {"id": "l3", "category": TagCategory.LIFESTYLE, "label_ko": "여행을 자주 가요 ✈️",   "label_ja": "よく旅行します ✈️", "label_zh": "常常旅遊 ✈️"},
    {"id": "l4", "category": TagCategory.LIFESTYLE, "label_ko": "건강관리 열심히",        "label_ja": "健康管理頑張ってます", "label_zh": "注重健康管理"},
    # 취미
    {"id": "h1", "category": TagCategory.HOBBY,     "label_ko": "카페 투어 ☕",           "label_ja": "カフェ巡り ☕",    "label_zh": "咖啡廳巡遊 ☕"},
    {"id": "h2", "category": TagCategory.HOBBY,     "label_ko": "영화/드라마 🎬",         "label_ja": "映画/ドラマ 🎬",  "label_zh": "電影/劇集 🎬"},
    {"id": "h3", "category": TagCategory.HOBBY,     "label_ko": "음악 듣기 🎵",           "label_ja": "音楽鑑賞 🎵",     "label_zh": "聽音樂 🎵"},
    {"id": "h4", "category": TagCategory.HOBBY,     "label_ko": "맛집 탐방 🍜",           "label_ja": "グルメ巡り 🍜",   "label_zh": "美食探索 🍜"},
    {"id": "h5", "category": TagCategory.HOBBY,     "label_ko": "독서 📚",                "label_ja": "読書 📚",          "label_zh": "閱讀 📚"},
    {"id": "h6", "category": TagCategory.HOBBY,     "label_ko": "게임 🎮",                "label_ja": "ゲーム 🎮",        "label_zh": "遊戲 🎮"},
]

# tag_id → tag 객체 빠른 조회용
TAG_MAP = {t["id"]: t for t in LIFESTYLE_TAGS}


# ── Pydantic 모델 ─────────────────────────────────────────────

class LifestyleTag(BaseModel):
    id:          str
    category:    TagCategory
    label_ko:    str
    label_ja:    str
    label_zh:    str


class RichProfile(BaseModel):
    """
    유저의 리치 프로필.
    기본 프로필(이름, 나이 등)은 users 테이블에 있으며,
    이 모델은 매칭용 심층 데이터만 담습니다.
    """
    user_id:          str
    voice_intro_url:  Optional[str]   = Field(None,  description="음성 소개글 S3 URL (최대 90초)")
    voice_duration_s: Optional[int]   = Field(None,  ge=1, le=90)
    dating_values:    str             = Field(...,   min_length=50, description="연애관 서술문 (50자 이상)")
    lifestyle_tag_ids: list[str]      = Field(...,   min_length=3, max_length=10,
                                              description="선택한 태그 ID 목록 (3~10개)")

    @field_validator("lifestyle_tag_ids")
    @classmethod
    def validate_tag_ids(cls, ids: list[str]) -> list[str]:
        for tag_id in ids:
            if tag_id not in TAG_MAP:
                raise ValueError(f"존재하지 않는 태그 ID: {tag_id}")
        return ids

    @property
    def tags(self) -> list[dict]:
        return [TAG_MAP[tid] for tid in self.lifestyle_tag_ids]


class MatchScoreResult(BaseModel):
    user_a_id:       str
    user_b_id:       str
    score:           float   = Field(..., description="가치관 일치율 0~100")
    grade:           str     = Field(..., description="S/A/B/C 등급")
    common_tag_ids:  list[str]
    common_tag_count: int
    category_scores: dict[str, float]   = Field(..., description="카테고리별 일치율")
    highlight:       str                 = Field(..., description="매칭 포인트 한 줄 요약")


class RichProfileUpsertRequest(BaseModel):
    voice_intro_url:   Optional[str] = None
    voice_duration_s:  Optional[int] = Field(None, ge=1, le=90)
    dating_values:     str           = Field(..., min_length=50)
    lifestyle_tag_ids: list[str]     = Field(..., min_length=3, max_length=10)


class RichProfileResponse(BaseModel):
    user_id:     str
    profile:     RichProfileUpsertRequest
    tags:        list[LifestyleTag]


# ── 매칭 점수 계산 로직 ──────────────────────────────────────

def _get_tag_weight(tag: dict) -> float:
    """태그의 카테고리 가중치를 반환."""
    return CATEGORY_WEIGHTS.get(tag["category"], 1.0)


def calculate_match_score(profile_a: RichProfile, profile_b: RichProfile) -> MatchScoreResult:
    """
    두 유저의 라이프스타일 태그를 비교해 가치관 일치율을 계산.

    알고리즘:
    1. 두 유저의 태그 집합 교집합 계산
    2. 교집합 태그의 가중치 합산
    3. (두 유저 중 태그 가중치 합이 큰 쪽)을 분모로 사용 → Jaccard 변형
    4. 카테고리별 세부 점수도 계산
    5. 0~100으로 정규화 후 등급 부여

    상충 태그 패널티:
    - 같은 카테고리에서 서로 다른 태그를 선택했고,
      그 태그가 상충 관계(예: '연락 자주' vs '연락 줄어도 OK')이면 감점
    """
    tags_a = {t["id"]: t for t in profile_a.tags}
    tags_b = {t["id"]: t for t in profile_b.tags}

    ids_a = set(tags_a.keys())
    ids_b = set(tags_b.keys())
    common_ids = ids_a & ids_b

    # 공통 태그 가중치 합
    common_weight = sum(_get_tag_weight(tags_a[tid]) for tid in common_ids)

    # 각자 태그 가중치 합
    weight_a = sum(_get_tag_weight(t) for t in tags_a.values())
    weight_b = sum(_get_tag_weight(t) for t in tags_b.values())

    # 분모: 두 유저 중 가중치 합이 큰 쪽 (Asymmetric Jaccard)
    denominator = max(weight_a, weight_b)
    base_score = (common_weight / denominator * 100) if denominator > 0 else 0.0

    # 상충 태그 패널티 계산
    # 같은 카테고리에서 선택했지만 공통이 아닌 태그 = 의견 충돌
    categories_a = {}
    for t in tags_a.values():
        categories_a.setdefault(t["category"], []).append(t["id"])
    categories_b = {}
    for t in tags_b.values():
        categories_b.setdefault(t["category"], []).append(t["id"])

    penalty = 0.0
    for cat in set(categories_a) & set(categories_b):
        ids_in_cat_a = set(categories_a[cat])
        ids_in_cat_b = set(categories_b[cat])
        conflict = ids_in_cat_a & ids_in_cat_b  # 공통 (충돌 없음)
        total_in_cat = ids_in_cat_a | ids_in_cat_b
        # 같은 카테고리인데 교집합 0 → 정반대 성향
        if not conflict and len(total_in_cat) >= 2:
            cat_weight = CATEGORY_WEIGHTS.get(cat, 1.0)
            penalty += cat_weight * 5.0  # 카테고리 가중치 × 5점 감점

    final_score = max(0.0, min(100.0, base_score - penalty))
    final_score = round(final_score, 1)

    # 카테고리별 세부 점수
    category_scores: dict[str, float] = {}
    for cat in TagCategory:
        cat_ids_a = {t["id"] for t in tags_a.values() if t["category"] == cat}
        cat_ids_b = {t["id"] for t in tags_b.values() if t["category"] == cat}
        if not cat_ids_a and not cat_ids_b:
            continue
        common_cat = cat_ids_a & cat_ids_b
        denom_cat = max(len(cat_ids_a), len(cat_ids_b))
        category_scores[cat.value] = round(len(common_cat) / denom_cat * 100, 0)

    # 등급 부여
    if final_score >= 80:
        grade = "S"
    elif final_score >= 65:
        grade = "A"
    elif final_score >= 50:
        grade = "B"
    else:
        grade = "C"

    # 하이라이트 문구 생성 (공통 태그 중 가중치 최고)
    highlight = _build_highlight(list(common_ids), tags_a)

    return MatchScoreResult(
        user_a_id=profile_a.user_id,
        user_b_id=profile_b.user_id,
        score=final_score,
        grade=grade,
        common_tag_ids=list(common_ids),
        common_tag_count=len(common_ids),
        category_scores=category_scores,
        highlight=highlight,
    )


def _build_highlight(common_ids: list[str], tags_map: dict) -> str:
    """공통 태그 중 가중치가 높은 것 2개로 하이라이트 문구 생성."""
    if not common_ids:
        return "서로를 알아가는 중이에요"

    sorted_ids = sorted(
        common_ids,
        key=lambda tid: _get_tag_weight(tags_map[tid]),
        reverse=True,
    )
    top = [tags_map[tid]["label_ko"] for tid in sorted_ids[:2]]

    if len(top) == 1:
        return f"{top[0].rstrip('📱🏃💍✈️☀️🌙☕🎬🎵🍜📚🎮')}가 잘 맞아요"
    return f"{top[0]}이고 {top[1]}인 두 분"


# ── 인메모리 저장소 (실제: DB) ────────────────────────────────
_rich_profiles: dict[str, RichProfile] = {}

# 테스트용 시드 데이터
_rich_profiles["user_yuki"] = RichProfile(
    user_id="user_yuki",
    voice_intro_url="https://cdn.realbridge.app/voice/yuki_intro.m4a",
    voice_duration_s=45,
    dating_values="서로의 문화를 존중하면서 천천히 가까워지는 관계를 원해요. 처음부터 무겁지 않게, 하지만 진심으로 다가가고 싶어요.",
    lifestyle_tag_ids=["c1", "w3", "f3", "f4", "v1", "l3", "h1", "h2"],
)
_rich_profiles["user_arya"] = RichProfile(
    user_id="user_arya",
    voice_intro_url=None,
    voice_duration_s=None,
    dating_values="연애는 서로를 바꾸는 게 아니라 서로에게 스며드는 것이라고 생각해요. 매일 연락하면서 작은 일상을 나누고 싶어요.",
    lifestyle_tag_ids=["c1", "w1", "f1", "f3", "v3", "l3", "h1", "h4"],
)


# ── FastAPI 라우터 ────────────────────────────────────────────

@router.get("/tags", response_model=list[LifestyleTag])
async def get_all_tags():
    """라이프스타일 태그 마스터 목록 조회."""
    return [
        LifestyleTag(
            id=t["id"],
            category=t["category"],
            label_ko=t["label_ko"],
            label_ja=t["label_ja"],
            label_zh=t["label_zh"],
        )
        for t in LIFESTYLE_TAGS
    ]


@router.get("/tags/{category}", response_model=list[LifestyleTag])
async def get_tags_by_category(category: TagCategory):
    """카테고리별 태그 조회."""
    filtered = [t for t in LIFESTYLE_TAGS if t["category"] == category]
    return [
        LifestyleTag(
            id=t["id"],
            category=t["category"],
            label_ko=t["label_ko"],
            label_ja=t["label_ja"],
            label_zh=t["label_zh"],
        )
        for t in filtered
    ]


@router.post("/profile/{user_id}", response_model=RichProfileResponse)
async def upsert_rich_profile(user_id: str, body: RichProfileUpsertRequest):
    """리치 프로필 저장/수정."""
    profile = RichProfile(user_id=user_id, **body.model_dump())
    _rich_profiles[user_id] = profile

    return RichProfileResponse(
        user_id=user_id,
        profile=body,
        tags=[
            LifestyleTag(
                id=t["id"],
                category=t["category"],
                label_ko=t["label_ko"],
                label_ja=t["label_ja"],
                label_zh=t["label_zh"],
            )
            for t in profile.tags
        ],
    )


@router.get("/score/{user_a_id}/{user_b_id}", response_model=MatchScoreResult)
async def get_match_score(user_a_id: str, user_b_id: str):
    """두 유저의 가치관 일치율 계산."""
    profile_a = _rich_profiles.get(user_a_id)
    profile_b = _rich_profiles.get(user_b_id)

    if not profile_a:
        raise HTTPException(status_code=404, detail=f"유저 {user_a_id}의 프로필이 없습니다.")
    if not profile_b:
        raise HTTPException(status_code=404, detail=f"유저 {user_b_id}의 프로필이 없습니다.")

    return calculate_match_score(profile_a, profile_b)


@router.get("/lock-status/{user_id}")
async def get_lock_status(user_id: str, db=Depends(get_admin_db)):
    """
    유저의 exclusive match lock 상태 조회.
    active/waiting 매치가 있으면 locked=True + 매치 정보 반환.
    """
    res = db.table("matches").select(
        "id, state, meetings_done, matched_at, user_a_id, user_b_id"
    ).in_("state", list(ACTIVE_MATCH_STATES)).or_(
        f"user_a_id.eq.{user_id},user_b_id.eq.{user_id}"
    ).limit(1).execute()

    if not res.data:
        return {"locked": False, "match": None}

    match = res.data[0]
    partner_id = match["user_b_id"] if match["user_a_id"] == user_id else match["user_a_id"]
    return {
        "locked": True,
        "match": {
            "match_id": match["id"],
            "state": match["state"],
            "meetings_done": match["meetings_done"],
            "meetings_remaining": max(0, 3 - match["meetings_done"]),
            "matched_at": match["matched_at"],
            "partner_id": partner_id,
        },
    }


@router.get("/candidates/{user_id}", response_model=list[MatchScoreResult])
async def get_ranked_candidates(
    user_id: str,
    min_score: float = 0.0,
    db=Depends(get_admin_db),
):
    """
    해당 유저와의 매칭 점수가 높은 순으로 후보 목록 반환.
    - 본인이 active 매치 중이면 빈 목록 반환 (재매칭 차단)
    - 이미 active 매치 중인 다른 유저도 후보에서 제외
    """
    my_profile = _rich_profiles.get(user_id)
    if not my_profile:
        raise HTTPException(status_code=404, detail="본인 프로필을 먼저 작성해 주세요.")

    # 본인 lock 확인
    my_lock = db.table("matches").select("id").in_(
        "state", list(ACTIVE_MATCH_STATES)
    ).or_(f"user_a_id.eq.{user_id},user_b_id.eq.{user_id}").limit(1).execute()
    if my_lock.data:
        return []  # 본인이 매칭 중 → 후보 없음

    # 현재 active 매치가 있는 유저 ID 수집 (후보에서 제외)
    locked_res = db.table("matches").select(
        "user_a_id, user_b_id"
    ).in_("state", list(ACTIVE_MATCH_STATES)).execute()

    locked_users: set[str] = set()
    for row in (locked_res.data or []):
        locked_users.add(str(row["user_a_id"]))
        locked_users.add(str(row["user_b_id"]))

    results = []
    for other_id, other_profile in _rich_profiles.items():
        if other_id == user_id:
            continue
        if other_id in locked_users:
            continue  # 이미 매칭 중인 유저 제외
        score_result = calculate_match_score(my_profile, other_profile)
        if score_result.score >= min_score:
            results.append(score_result)

    results.sort(key=lambda r: r.score, reverse=True)
    return results


class CreateMatchRequest(BaseModel):
    user_a_id: str
    user_b_id: str


@router.post("/create")
async def create_match(req: CreateMatchRequest, db=Depends(get_admin_db)):
    """
    관리자가 두 유저를 매칭.
    둘 중 하나라도 active 매치가 있으면 409 Conflict.
    DB 트리거가 2차 방어선 역할을 함.
    """
    WEEKLY_INTRO_LIMIT = 3

    # 양쪽 lock 확인 + 주간 소개팅 제한 확인
    for uid, label in [(req.user_a_id, "user_a"), (req.user_b_id, "user_b")]:
        lock = db.table("matches").select("id").in_(
            "state", list(ACTIVE_MATCH_STATES)
        ).or_(f"user_a_id.eq.{uid},user_b_id.eq.{uid}").limit(1).execute()
        if lock.data:
            raise HTTPException(
                status_code=409,
                detail=f"{label} ({uid}) 는 현재 매칭 진행 중입니다. 3회 만남이 완료되거나 매칭이 종료된 후 새 매칭이 가능합니다.",
            )

        # 주간 소개팅 제한 (3명/주)
        user_row = db.table("users").select("weekly_intro_count").eq("id", uid).single().execute()
        if user_row.data and (user_row.data.get("weekly_intro_count") or 0) >= WEEKLY_INTRO_LIMIT:
            raise HTTPException(
                status_code=429,
                detail=f"{label} ({uid}) 는 이번 주 소개팅 한도(3명)에 도달했습니다. 다음 주 월요일에 초기화됩니다.",
            )

    try:
        result = db.table("matches").insert({
            "user_a_id": req.user_a_id,
            "user_b_id": req.user_b_id,
            "state": "waiting",
        }).execute()

        match_id = result.data[0]["id"] if result.data else None

        # 주간 소개팅 카운터 증가 + 인앱 알림 (양쪽)
        for uid in [req.user_a_id, req.user_b_id]:
            cur = db.table("users").select("weekly_intro_count").eq("id", uid).single().execute()
            cur_count = (cur.data.get("weekly_intro_count") or 0) if cur.data else 0
            db.table("users").update({
                "weekly_intro_count": cur_count + 1
            }).eq("id", uid).execute()

            # 새 소개팅 알림
            if match_id:
                db.table("notifications").insert({
                    "user_id": uid,
                    "type":    "new_intro",
                    "title":   "💌 새로운 소개팅이 도착했어요!",
                    "body":    "큐레이터가 정성껏 고른 상대방이에요. 지금 채팅을 시작해보세요.",
                    "is_read": False,
                    "data":    {"match_id": match_id},
                }).execute()
    except Exception as e:
        err_str = str(e)
        if "already has an active match" in err_str:
            raise HTTPException(status_code=409, detail="두 유저 중 이미 매칭 중인 유저가 있습니다.")
        raise HTTPException(status_code=500, detail=f"매칭 생성 실패: {err_str}")

    return {"success": True, "match": result.data[0] if result.data else None}
