# app/api/v1/calendar.py

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.calendar import CalendarResponse, TimelineResponse
from app.services import calendar as calendar_service
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/{year}/{month}", response_model=CalendarResponse)
def get_monthly_calendar(
    year: int,
    month: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not (1 <= month <= 12):
        raise HTTPException(status_code=400, detail="유효하지 않은 월입니다")

    return calendar_service.get_monthly_calendar(
        user_id=str(current_user.id),
        year=year,
        month=month,
        db=db,
    )


@router.get("/{date}/timeline", response_model=TimelineResponse)
def get_timeline(
    date: date,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = calendar_service.get_timeline(
        user_id=str(current_user.id),
        target_date=date,
        db=db,
    )

    if result is None:
        raise HTTPException(status_code=404, detail="해당 날짜의 데이터가 없습니다")

    return result
