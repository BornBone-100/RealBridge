"""
관리자 매칭 시뮬레이션 데모 API
================================
관리자 전용 테스트 SMS 발송 엔드포인트.
실제 배포 시 관리자 인증 미들웨어 추가 권장.
"""

import os
from fastapi import APIRouter
from pydantic import BaseModel
from routers.concierge import send_solapi_sms

router = APIRouter(prefix="/api/demo", tags=["demo"])

ADMIN_PHONE = os.getenv("ADMIN_PHONE", "01059006834")


class TestSmsRequest(BaseModel):
    to: str = ADMIN_PHONE
    matched_name: str


@router.post("/send-test-sms")
async def send_test_sms(req: TestSmsRequest):
    """
    관리자 번호로 매칭 성사 테스트 SMS 발송.
    시뮬레이션 페이지의 '테스트 SMS 보내기' 버튼에서 호출.
    """
    # 발신 대상을 관리자 번호로만 제한 (보안)
    target = ADMIN_PHONE

    message = (
        f"[3rd Vibe] 새로운 매칭이 성사되었습니다! 🎉\n"
        f"{req.matched_name}님과 매칭되었어요.\n"
        f"앱에서 채팅을 시작해 보세요."
    )

    await send_solapi_sms(target, message)

    return {
        "sent": True,
        "to": target,
        "matched_name": req.matched_name,
        "preview": message,
    }
