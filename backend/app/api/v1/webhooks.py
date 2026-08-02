"""RevenueCat 웹훅 수신 엔드포인트.

JWT 대신 대시보드에 설정한 Authorization 비밀값으로 검증한다.
"""

import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.services.revenuecat_webhook import process_webhook_event

logger = logging.getLogger(__name__)

router = APIRouter(tags=["webhooks"])


@router.post("/api/v1/webhooks/revenuecat")
async def receive_revenuecat_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """RevenueCat 웹훅 수신. 정상/무시/중복 모두 200, 내부 오류만 500(재시도 유도)."""
    # 비밀값 미설정 상태로 엔드포인트가 열리는 것 방지
    if not settings.REVENUECAT_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="웹훅이 설정되지 않았습니다")

    auth = request.headers.get("Authorization", "")
    if not secrets.compare_digest(
        auth.encode(), settings.REVENUECAT_WEBHOOK_SECRET.encode()
    ):
        raise HTTPException(status_code=401, detail="인증 실패")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="잘못된 JSON입니다")

    event = body.get("event") if isinstance(body, dict) else None
    if not isinstance(event, dict):
        raise HTTPException(status_code=400, detail="event 필드가 없습니다")

    try:
        await process_webhook_event(db, event)
    except Exception:
        # 상세는 로그에만 남기고 응답엔 노출하지 않는다
        logger.exception("RevenueCat 웹훅 처리 실패")
        raise HTTPException(status_code=500, detail="웹훅 처리 실패")

    return {"received": True}
