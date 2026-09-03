from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.schemas.subscription import SubscriptionResponse
from app.services.subscription import get_user_subscription
from app.utils.dependencies import get_current_user

router = APIRouter(tags=["subscription"])


def _as_response(subscription) -> SubscriptionResponse:
    """응답 변환. 베타 전원 프리미엄이면 표시용 값만 프리미엄으로 바꾼다.

    DB 객체를 수정하면 세션에 그대로 반영되고, 웹훅의 첫 결제 판정(was_premium)도
    망가진다. 그래서 응답 모델에서만 덮어쓴다.
    """
    response = SubscriptionResponse.model_validate(subscription)
    if settings.BETA_ALL_PREMIUM:
        response.plan = "premium"
        response.is_active = True
        response.expires_at = None  # 프론트가 만료로 판정하지 않도록
    return response


@router.get("/api/v1/subscriptions/me", response_model=SubscriptionResponse)
async def get_subscription(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """내 구독 정보 조회"""
    subscription = await get_user_subscription(db, current_user.id)
    return _as_response(subscription)


# PUT /subscriptions/me 와 POST /subscriptions/verify 는 제거했다.
# 둘 다 로그인만 하면 결제 없이 프리미엄이 될 수 있었다. PUT은 plan_type을
# 그대로 받았고, verify의 검증기는 "mock:<id>:<cycle>" 형식이면 통과하는
# 개발용이었다. 실제 결제 반영은 RevenueCat 웹훅(/webhooks/revenuecat)이 한다.
