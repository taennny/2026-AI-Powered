import uuid

import httpx
from geoalchemy2.functions import ST_X, ST_Y
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.daily_record import DailyRecord
from app.models.place import Place


async def get_place_or_raise(
    db: AsyncSession, place_id: uuid.UUID, user_id: uuid.UUID
) -> Place:
    result = await db.execute(
        select(Place).where(Place.id == place_id).where(Place.user_id == user_id)
    )
    place = result.scalar_one_or_none()
    if not place:
        raise ValueError("장소를 찾을 수 없습니다")
    return place


async def update_place(
    db: AsyncSession,
    place_id: uuid.UUID,
    user_id: uuid.UUID,
    name: str,
    category: str | None,
) -> Place:
    place = await get_place_or_raise(db, place_id, user_id)
    place.name = name
    place.category = category
    place.is_corrected = True
    await db.commit()
    await db.refresh(place)
    return place


async def delete_place(db: AsyncSession, place_id: uuid.UUID, user_id: uuid.UUID) -> None:
    place = await get_place_or_raise(db, place_id, user_id)
    place.is_deleted = True

    if place.daily_record_id:
        dr_result = await db.execute(
            select(DailyRecord).where(DailyRecord.id == place.daily_record_id)
        )
        daily_record = dr_result.scalar_one_or_none()
        if daily_record and daily_record.place_count > 0:
            daily_record.place_count -= 1

    await db.commit()


async def get_candidates(db: AsyncSession, place_id: uuid.UUID, user_id: uuid.UUID) -> dict:
    place = await get_place_or_raise(db, place_id, user_id)

    result = await db.execute(
        select(ST_Y(Place.location), ST_X(Place.location)).where(Place.id == place_id)
    )
    lat, lng = result.one()

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"{settings.AI_SERVER_URL}/api/ai/candidates",
            params={"lat": lat, "lng": lng, "exclude": place.name},
        )
        response.raise_for_status()
        return response.json()


async def search_places(lat: float, lng: float, query: str) -> dict:
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"{settings.AI_SERVER_URL}/api/ai/search",
            params={"lat": lat, "lng": lng, "query": query},
        )
        response.raise_for_status()
        return response.json()