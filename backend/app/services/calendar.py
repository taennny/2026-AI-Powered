# app/services/calendar.py

import calendar
from datetime import date

from geoalchemy2.shape import to_shape
from sqlalchemy import and_, exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.daily_record import DailyRecord
from app.models.gps_log import GpsLog
from app.models.photos import Photo
from app.models.place import Place
from app.services.storage import get_presigned_url
from app.utils.timezone import day_bounds

try:
    from app.models.blog import Blog

    BLOG_MODEL_AVAILABLE = True
except ImportError:
    BLOG_MODEL_AVAILABLE = False


async def get_monthly_calendar(
    user_id: str, year: int, month: int, db: AsyncSession
) -> dict:
    _, last_day = calendar.monthrange(year, month)
    start_date = date(year, month, 1)
    end_date = date(year, month, last_day)

    result = await db.execute(
        select(DailyRecord).where(
            and_(
                DailyRecord.user_id == user_id,
                DailyRecord.target_date >= start_date,
                DailyRecord.target_date <= end_date,
            )
        )
    )
    records = result.scalars().all()

    days = []
    for record in records:
        has_timeline_result = await db.execute(
            select(exists().where(Place.daily_record_id == record.id))
        )
        has_timeline = has_timeline_result.scalar()

        if BLOG_MODEL_AVAILABLE:
            has_journal_result = await db.execute(
                select(exists().where(Blog.daily_record_id == record.id))
            )
            has_journal = has_journal_result.scalar()
        else:
            has_journal = False

        days.append(
            {
                "date": record.target_date.strftime("%Y-%m-%d"),
                "has_journal": has_journal,
                "has_timeline": has_timeline,
            }
        )

    return {"year": year, "month": month, "days": days}


async def get_timeline(
    user_id: str, target_date: date, db: AsyncSession
) -> dict | None:
    result = await db.execute(
        select(DailyRecord).where(
            and_(
                DailyRecord.user_id == user_id,
                DailyRecord.target_date == target_date,
            )
        )
    )
    record = result.scalar_one_or_none()

    if not record:
        return None

    # GPS 로그도 하루 경계(04:00 KST) 기준으로 조회
    start_dt, end_dt = day_bounds(target_date)
    gps_result = await db.execute(
        select(GpsLog)
        .where(
            and_(
                GpsLog.user_id == user_id,
                GpsLog.recorded_at >= start_dt,
                GpsLog.recorded_at < end_dt,
            )
        )
        .order_by(GpsLog.recorded_at)
    )
    gps_logs = gps_result.scalars().all()

    polyline = [
        {"lat": to_shape(log.location).y, "lng": to_shape(log.location).x}
        for log in gps_logs
    ]

    places_result = await db.execute(
        select(Place)
        .where(Place.daily_record_id == record.id)
        .order_by(Place.arrived_at)
    )
    places = places_result.scalars().all()

    # 사진 한 번에 가져오기 (N+1 제거)
    photos_result = await db.execute(
        select(Photo)
        .where(
            and_(
                Photo.user_id == user_id,
                Photo.daily_record_id == record.id,
            )
        )
        .order_by(Photo.id)
    )
    all_photos = photos_result.scalars().all()

    place_list = []
    for place in places:
        place_photos = [
            p
            for p in all_photos
            if p.taken_at
            and place.arrived_at
            and place.left_at
            and place.arrived_at <= p.taken_at <= place.left_at
        ]
        photo_urls = []
        for photo in place_photos:
            url = await get_presigned_url(photo.storage_key)
            photo_urls.append(url)

        place_list.append(
            {
                "place_id": str(place.id),
                "name": place.name,
                "category": place.category,
                "arrived_at": place.arrived_at,
                "left_at": place.left_at,
                "lat": to_shape(place.location).y,
                "lng": to_shape(place.location).x,
                "photos": photo_urls,
            }
        )

    return {
        "date": record.target_date.strftime("%Y-%m-%d"),
        "daily_record_id": str(record.id),
        "polyline": polyline,
        "places": place_list,
    }
