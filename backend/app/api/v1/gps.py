from datetime import date

from fastapi import APIRouter, Depends, status
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    place_count = await analyze_and_save(db, current_user.id, date)
    return AnalyzeResponse(message="분석 완료", place_count=place_count)
