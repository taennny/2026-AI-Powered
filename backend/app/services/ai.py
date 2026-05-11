import logging
import math
import uuid
from datetime import date, datetime, timezone

import httpx
from geoalchemy2.elements import WKTElement
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.daily_record import DailyRecord
from app.models.gps_log import GpsLog
from app.models.photos import Photo
from app.models.place import Place
from app.schemas.ai import AIAnalyzeRequest, AIAnalyzeResponse, AIGpsLogItem

logger = logging.getLogger(__name__)


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """두 좌표 간 거리 계산 (km)"""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return R * 2 * math.asin(math.sqrt(a))


async def analyze_and_save(
    db: AsyncSession, user_id: uuid.UUID, target_date: date
) -> int:
    # 1. 해당 날짜 GPS 로그 조회
    start_dt = datetime(
        target_date.year,
        target_date.month,
        target_date.day,
        0,
        0,
        0,
        tzinfo=timezone.utc,
    )
    end_dt = datetime(
        target_date.year,
        target_date.month,
        target_date.day,
        23,
        59,
        59,
        tzinfo=timezone.utc,
    )

    result = await db.execute(
        select(
            GpsLog.recorded_at,
            func.ST_Y(GpsLog.location).label("lat"),
            func.ST_X(GpsLog.location).label("lng"),
        )
        .where(GpsLog.user_id == user_id)
        .where(GpsLog.recorded_at >= start_dt)
        .where(GpsLog.recorded_at <= end_dt)
        .order_by(GpsLog.recorded_at)
    )
    log_rows = result.all()

    if not log_rows:
        logger.info(f"GPS 로그 없음: user={user_id}, date={target_date}")
        return 0

    # 2. total_distance 계산
    total_distance = 0.0
    for i in range(1, len(log_rows)):
        total_distance += _haversine_km(
            log_rows[i - 1].lat,
            log_rows[i - 1].lng,
            log_rows[i].lat,
            log_rows[i].lng,
        )

    # 3. AI 서버 호출
    gps_items = [
        AIGpsLogItem(time=row.recorded_at, lat=row.lat, lng=row.lng) for row in log_rows
    ]
    request_body = AIAnalyzeRequest(user_id=str(user_id), gps_logs=gps_items)

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.AI_SERVER_URL}/api/ai/analyze",
                json=request_body.model_dump(mode="json"),
            )
            response.raise_for_status()
            ai_response = AIAnalyzeResponse.model_validate(response.json())
            stays = ai_response.stays
    except Exception as e:
        logger.error(
            f"AI 서버 호출 실패: user={user_id}, date={target_date}, error={e}"
        )
        return 0

    # 4. daily_record upsert
    photo_result = await db.execute(
        select(func.count(Photo.id))
        .where(Photo.user_id == user_id)
        .where(func.date(Photo.taken_at) == target_date)
    )
    photo_count = photo_result.scalar() or 0

    dr_result = await db.execute(
        select(DailyRecord)
        .where(DailyRecord.user_id == user_id)
        .where(DailyRecord.target_date == target_date)
    )
    daily_record = dr_result.scalar_one_or_none()

    if daily_record is None:
        daily_record = DailyRecord(
            user_id=user_id,
            target_date=target_date,
            total_distance=round(total_distance, 2),
            place_count=len(stays),
            photo_count=photo_count,
        )
        db.add(daily_record)
        await db.flush()  # id 확보
    else:
        daily_record.total_distance = round(total_distance, 2)
        daily_record.place_count = len(stays)
        daily_record.photo_count = photo_count
        daily_record.updated_at = datetime.now(timezone.utc)

    # 5. places 저장
    for stay in stays:
        place = Place(
            user_id=user_id,
            daily_record_id=daily_record.id,
            name=stay.place_name,
            category=stay.category,
            location=WKTElement(f"POINT({stay.lng} {stay.lat})", srid=4326),
            arrived_at=stay.start,
            left_at=stay.end,
            is_corrected=False,
        )
        db.add(place)

    await db.commit()
    return len(stays)
