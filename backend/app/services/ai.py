import logging
import math
import uuid
from datetime import date, datetime, timezone

import httpx
from geoalchemy2.elements import WKTElement
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.daily_record import DailyRecord
from app.models.gps_log import GpsLog
from app.models.photos import Photo
from app.models.place import Place
from app.schemas.ai import AIAnalyzeRequest, AIAnalyzeResponse, AIGpsLogItem
from app.utils.timezone import day_bounds

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
    db: AsyncSession,
    user_id: uuid.UUID,
    target_date: date,
    user_timezone: str | None = None,
) -> tuple[uuid.UUID | None, int]:
    # 0. 그날의 daily_record를 먼저 읽는다 — 하루를 어느 시간대의 04시로 자를지가
    # 그 안에 들어 있다.
    dr_result = await db.execute(
        select(DailyRecord)
        .where(DailyRecord.user_id == user_id)
        .where(DailyRecord.target_date == target_date)
    )
    daily_record = dr_result.scalar_one_or_none()

    # 하루의 시간대는 그 기록이 처음 만들어질 때 정해지고 이후 바뀌지 않는다.
    # 재분석마다 요청 tz로 덮으면 여행 중에 하루 경계가 밀려서
    # 이미 저장된 장소들이 다른 날짜로 튄다.
    tz_name = daily_record.timezone if daily_record else user_timezone

    # 1. 해당 날짜 GPS 로그 조회 (하루 경계: 그 시간대의 04:00 기준)
    start_dt, end_dt = day_bounds(target_date, tz_name)

    result = await db.execute(
        select(
            GpsLog.recorded_at,
            func.ST_Y(GpsLog.location).label("lat"),
            func.ST_X(GpsLog.location).label("lng"),
            GpsLog.accuracy,
        )
        .where(GpsLog.user_id == user_id)
        .where(GpsLog.recorded_at >= start_dt)
        .where(GpsLog.recorded_at < end_dt)
        .order_by(GpsLog.recorded_at)
    )
    log_rows = result.all()

    if not log_rows:
        logger.info(f"GPS 로그 없음: user={user_id}, date={target_date}")
        return None, 0

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
        AIGpsLogItem(
            time=row.recorded_at, lat=row.lat, lng=row.lng, accuracy=row.accuracy
        )
        for row in log_rows
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
        raise

    # 4. stays가 비어있으면 AI 분석 실패/무응답으로 보고 기존 기록을 건드리지 않는다.
    if not stays:
        logger.warning(
            f"AI 분석 결과 0건 — 기존 기록 보존: user={user_id}, date={target_date}"
        )
        return (daily_record.id if daily_record else None), 0

    # 5. daily_record upsert (사진도 같은 04:00 경계 기준으로 집계)
    photo_result = await db.execute(
        select(func.count(Photo.id))
        .where(Photo.user_id == user_id)
        .where(Photo.taken_at >= start_dt)
        .where(Photo.taken_at < end_dt)
    )
    photo_count = photo_result.scalar() or 0

    if daily_record is None:
        daily_record = DailyRecord(
            user_id=user_id,
            target_date=target_date,
            total_distance=round(total_distance, 2),
            place_count=0,
            photo_count=photo_count,
            timezone=user_timezone,
        )
        db.add(daily_record)
        await db.flush()
    else:
        daily_record.total_distance = round(total_distance, 2)
        daily_record.photo_count = photo_count
        daily_record.updated_at = datetime.now(timezone.utc)
        await db.flush()

    # 6. 해당 날짜 사진들 daily_record에 연결 (같은 04:00 경계 기준)
    await db.execute(
        update(Photo)
        .where(Photo.user_id == user_id)
        .where(Photo.taken_at >= start_dt)
        .where(Photo.taken_at < end_dt)
        .values(daily_record_id=daily_record.id)
    )

    # 7. places 저장 — 재분석이므로 기존 결과를 지우고 다시 쓴다.
    # 단, is_corrected=True(사용자 수정) 또는 is_deleted=True(사용자 삭제)인
    # 장소는 재분석해도 보존한다 — 삭제된 장소는 그 시간대를 "빈 상태"로 유지하기 위함.
    await db.execute(
        delete(Place)
        .where(Place.daily_record_id == daily_record.id)
        .where(Place.is_corrected.is_(False))
        .where(Place.is_deleted.is_(False))
    )

    # 보존된 장소(수정됨 또는 삭제됨)들의 시간 구간을 미리 조회 —
    # 이 구간과 겹치는 새 stay는 만들지 않는다.
    preserved_result = await db.execute(
        select(Place.arrived_at, Place.left_at, Place.is_deleted)
        .where(Place.daily_record_id == daily_record.id)
        .where((Place.is_corrected.is_(True)) | (Place.is_deleted.is_(True)))
    )
    preserved_ranges = preserved_result.all()

    def _overlaps_preserved(stay_start: datetime, stay_end: datetime) -> bool:
        for p_start, p_end, _ in preserved_ranges:
            p_end_cmp = p_end or p_start
            stay_end_cmp = stay_end or stay_start
            if stay_start < p_end_cmp and p_start < stay_end_cmp:
                return True
        return False

    visible_count = sum(1 for _, _, is_del in preserved_ranges if not is_del)

    new_place_count = 0
    for stay in stays:
        if _overlaps_preserved(stay.start, stay.end):
            continue
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
        new_place_count += 1

    daily_record.place_count = visible_count + new_place_count

    await db.commit()
    return daily_record.id, len(stays)
