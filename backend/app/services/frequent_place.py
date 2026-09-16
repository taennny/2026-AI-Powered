import uuid

from geoalchemy2 import WKTElement
from geoalchemy2.shape import to_shape
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.frequent_place import FrequentPlace
from app.schemas.frequent_place import FrequentPlaceCreateRequest

# 이 타입들은 유저당 1개만 허용된다 — 재등록 시 기존 것을 자동 교체(덮어쓰기)한다.
SINGLE_INSTANCE_TYPES = {"home", "workSchool"}


async def create_frequent_place(
    db: AsyncSession, user_id: uuid.UUID, request: FrequentPlaceCreateRequest
) -> FrequentPlace:
    """자주가는곳 등록

    place_type이 home/workSchool이면 유저당 1개만 허용되므로,
    기존 같은 타입이 있으면 먼저 삭제하고(덮어쓰기) 새로 생성한다.
    """
    if request.place_type in SINGLE_INSTANCE_TYPES:
        await db.execute(
            delete(FrequentPlace)
            .where(FrequentPlace.user_id == user_id)
            .where(FrequentPlace.place_type == request.place_type)
        )

    point = WKTElement(f"POINT({request.longitude} {request.latitude})", srid=4326)
    place = FrequentPlace(
        id=uuid.uuid4(),
        user_id=user_id,
        name=request.name,
        place_type=request.place_type,
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


async def delete_frequent_place(
    db: AsyncSession, place_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    result = await db.execute(
        select(FrequentPlace)
        .where(FrequentPlace.id == place_id)
        .where(FrequentPlace.user_id == user_id)
    )
    place = result.scalar_one_or_none()
    if not place:
        raise ValueError("장소를 찾을 수 없습니다")

    await db.delete(place)
    await db.commit()


def to_response_dict(place: FrequentPlace) -> dict:
    """Geometry → lat/lng 변환해서 응답용 dict로"""
    point = to_shape(place.location)
    return {
        "place_id": place.id,
        "name": place.name,
        "place_type": place.place_type,
        "address": place.address,
        "latitude": point.y,
        "longitude": point.x,
        "created_at": place.created_at,
    }
