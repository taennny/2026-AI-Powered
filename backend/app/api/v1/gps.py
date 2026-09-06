from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.ai import AnalyzeResponse
from app.schemas.gps import GPSLogBatchRequest, GPSLogBatchResponse
from app.services.ai import analyze_and_save
from app.services.gps import save_gps_logs
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/api/v1/gps", tags=["GPS"])


@router.post(
    "/logs", response_model=GPSLogBatchResponse, status_code=status.HTTP_201_CREATED
)
async def upload_gps_logs(
    request: GPSLogBatchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    saved_count = await save_gps_logs(db, str(current_user.id), request)
    return GPSLogBatchResponse(saved_count=saved_count)


@router.post("/logs/{date}/analyze", response_model=AnalyzeResponse)
async def analyze_gps_logs(
    date: date,
    user_timezone: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        daily_record_id, place_count = await analyze_and_save(
            db, current_user.id, date, timezone=user_timezone
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI 서버 호출에 실패했습니다",
        )

    if daily_record_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="해당 날짜에 분석할 GPS 로그가 없습니다",
        )

    return AnalyzeResponse(
        daily_record_id=daily_record_id,
        message="분석 완료",
        place_count=place_count,
    )
