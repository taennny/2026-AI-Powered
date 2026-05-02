from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.subscription import SubscriptionResponse, SubscriptionUpdateRequest
from app.services.subscription import get_user_subscription, update_user_subscription
from app.utils.dependencies import get_current_user

router = APIRouter(tags=["subscription"])


@router.get("/api/v1/subscriptions/me", response_model=SubscriptionResponse)
async def get_subscription(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """내 구독 정보 조회"""
    subscription = await get_user_subscription(db, current_user.id)
    return subscription


@router.put("/api/v1/subscriptions/me", response_model=SubscriptionResponse)
async def change_subscription(
    request: SubscriptionUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """구독 플랜 변경"""
    try:
        subscription = await update_user_subscription(
            db, current_user.id, request.plan_type
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return subscription
