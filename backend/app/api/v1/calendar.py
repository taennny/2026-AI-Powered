import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.daily_record import DailyRecord
from app.schemas.calendar import DailyRecordResponse

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/{date}/timeline", response_model=DailyRecordResponse)
async def get_timeline(
    date: date,
    user_id: uuid.UUID = Query(...),
    db: AsyncSession = Depends(get_db),
) -> DailyRecordResponse:
    result = await db.execute(
        select(DailyRecord).where(
            DailyRecord.user_id == user_id,
            DailyRecord.target_date == date,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="No timeline found for this date")
    return DailyRecordResponse.model_validate(record)
