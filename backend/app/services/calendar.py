# app/services/calendar.py

import calendar
from datetime import date

from geoalchemy2.shape import to_shape
from sqlalchemy import Text, and_, cast, exists, or_, select
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
            # 하루짜리 글은 daily_record_id로, 모아쓰기 글은 target_dates(포함된
            # 날짜 목록)로 판정한다. 모아쓰기는 daily_record_id가 비어 있어서
            # 그 조건만 보면 캘린더에 아예 표시되지 않는다.
            # JSON 컬럼에 .contains()를 쓰면 LIKE로 컴파일되는데, PostgreSQL의
            # json 타입에는 LIKE 연산자가 없어 쿼리 전체가 실패한다
            # (operator does not exist: json ~~ text). SQLite에서는 통과해서
            # 테스트로 걸리지 않았다. 텍스트로 캐스팅하면 두 DB 모두 동작한다.
            # 날짜를 따옴표까지 포함해 찾으므로 다른 값에 잘못 걸리지 않는다.
            date_key = f'"{record.target_date.isoformat()}"'
            has_journal_result = await db.execute(
                select(
                    exists().where(
                        and_(
                            Blog.user_id == user_id,
                            Blog.deleted_at.is_(None),
                            or_(
                                Blog.daily_record_id == record.id,
                                Blog.target_dates.isnot(None)
                                & cast(Blog.target_dates, Text).like(f"%{date_key}%"),
                            ),
                        )
                    )
                )
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

    # GPS 로그도 하루 경계(04:00) 기준으로 조회 — 그 기록의 시간대를 쓴다.
    # 여기만 KST로 남으면 해외에서 지도 폴리라인만 어긋난다.
    start_dt, end_dt = day_bounds(target_date, record.timezone)
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
    # 정렬이 없으면 DB가 순서를 보장하지 않아, 프론트가 쓰는 첫 장(photos[0])이
    # 조회할 때마다 달라져 카드 사진이 바뀐다.
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

        # 프론트는 카드당 첫 장만 쓰므로 나머지는 presigned URL 만들지 않는다.
        photo_urls = []
        if place_photos:
            url = await get_presigned_url(place_photos[0].storage_key)
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
