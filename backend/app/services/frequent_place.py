# app/services/frequent_place.py
import uuid

from geoalchemy2 import WKTElement
from geoalchemy2.shape import to_shape
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.frequent_place import FrequentPlace
from app.schemas.frequent_place import FrequentPlaceCreateRequest


async def create_frequent_place(
    db: AsyncSession, user_id: uuid.UUID, request: FrequentPlaceCreateRequest
) -> FrequentPlace:
    """자주가는곳 등록"""
    point = WKTElement(f"POINT({request.longitude} {request.latitude})", srid=4326)
    place = FrequentPlace(
        id=uuid.uuid4(),
        user_id=user_id,
        name=request.name,
        address=request.address,
        location=point,
    )
    db.add(place)
    await db.commit()
    await db.refresh(place)
    return place


async def get_frequent_places(
    db: AsyncSession, user_id: uuid.UUID
) -> list[FrequentPlace]:
    """자주가는곳 목록 조회"""
    result = await db.execute(
        select(FrequentPlace).where(FrequentPlace.user_id == user_id)
    )
    return list(result.scalars().all())


def to_response_dict(place: FrequentPlace) -> dict:
    """Geometry → lat/lng 변환해서 응답용 dict로"""
    point = to_shape(place.location)
    return {
        "place_id": place.id,
        "name": place.name,
        "address": place.address,
        "latitude": point.y,
        "longitude": point.x,
        "created_at": place.created_at,
    }
