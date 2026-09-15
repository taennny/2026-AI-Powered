"""장소 카드 사진 교체·삭제.

`services/photos.py`의 업로드는 EXIF 촬영시각으로 장소를 찾는다. 여기는 사용자가
직접 고른 사진이라 촬영시각이 그 장소 시간대 밖일 수 있어, `place_id`로 직접 묶는다.
"""

import logging
import uuid

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.photos import Photo
from app.models.place import Place
from app.services.photos import (
    HEIC_TYPES,
    _convert_heic_to_jpeg,
    _make_thumbnail,
    _parse_exif,
)
from app.services.storage import delete_file, get_presigned_url, upload_file

logger = logging.getLogger(__name__)


async def _get_place_or_raise(
    db: AsyncSession, place_id: uuid.UUID, user_id: uuid.UUID
) -> Place:
    result = await db.execute(
        select(Place).where(Place.id == place_id).where(Place.user_id == user_id)
    )
    place = result.scalar_one_or_none()
    if not place:
        raise ValueError("장소를 찾을 수 없습니다")
    return place


async def _current_photos(
    db: AsyncSession, place: Place, user_id: uuid.UUID
) -> list[Photo]:
    """그 카드에 지금 보이는 사진 — place_id로 묶인 것과 시간대로 걸리는 것 모두."""
    conditions = [Photo.place_id == place.id]
    if place.arrived_at and place.left_at:
        conditions.append(
            Photo.taken_at.between(place.arrived_at, place.left_at),
        )

    result = await db.execute(
        select(Photo)
        .where(Photo.user_id == user_id)
        .where(Photo.is_deleted.is_(False))
        .where(or_(*conditions))
    )
    return list(result.scalars().all())


async def _tombstone(photos: list[Photo]) -> None:
    """실제 파일만 지우고 row는 묘비로 남긴다 — 재업로드로 되살아나는 것을 막는다."""
    for photo in photos:
        photo.is_deleted = True
        for key in (photo.storage_key, photo.thumbnail_key):
            if not key:
                continue
            try:
                await delete_file(key)
            except Exception:
                # 파일 삭제 실패로 요청 전체를 되돌리면 묘비도 안 남아 사진이 되살아난다
                logger.warning("사진 파일 삭제 실패 (묘비는 남김): %s", key)


async def tombstone_bound_photos(
    db: AsyncSession, place_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    """장소 삭제 시 그 카드 전용 사진만 정리한다 — 자동 첨부분은 그날 사진이라 건드리지 않는다"""
    result = await db.execute(
        select(Photo)
        .where(Photo.user_id == user_id)
        .where(Photo.place_id == place_id)
        .where(Photo.is_deleted.is_(False))
    )
    await _tombstone(list(result.scalars().all()))


async def replace_place_photo(
    db: AsyncSession,
    place_id: uuid.UUID,
    user_id: uuid.UUID,
    file_bytes: bytes,
    content_type: str,
) -> tuple[Photo, str, str]:
    """기존 사진을 지우고 고른 사진으로 갈아 끼운다. @returns (photo, 원본 url, 썸네일 url)"""
    place = await _get_place_or_raise(db, place_id, user_id)

    if content_type in HEIC_TYPES:
        file_bytes, exif_bytes = _convert_heic_to_jpeg(file_bytes)
        content_type = "image/jpeg"
        exif = _parse_exif(exif_bytes) if exif_bytes else {"taken_at": None}
    else:
        exif = _parse_exif(file_bytes)

    await _tombstone(await _current_photos(db, place, user_id))

    photo_id = uuid.uuid4()
    ext = "jpg" if "jpeg" in content_type else "png"
    storage_key = f"photos/{user_id}/{photo_id}.{ext}"
    await upload_file(storage_key, file_bytes, content_type)

    thumbnail_key: str | None = None
    thumbnail_bytes = _make_thumbnail(file_bytes)
    if thumbnail_bytes is not None:
        thumbnail_key = f"photos/{user_id}/{photo_id}_thumb.jpg"
        await upload_file(thumbnail_key, thumbnail_bytes, "image/jpeg")

    photo = Photo(
        id=photo_id,
        user_id=user_id,
        daily_record_id=place.daily_record_id,
        place_id=place.id,
        storage_key=storage_key,
        thumbnail_key=thumbnail_key,
        # EXIF가 없어도 받는다 — 장소는 place_id로 정해지므로 촬영시각이 필요 없다
        taken_at=exif["taken_at"],
    )
    db.add(photo)
    # 재분석이 이 Place를 지우면 FK가 깨지고 사진 연결도 풀린다 (ai.py의 보존 규칙에 편입)
    place.is_corrected = True
    # 직접 골라 넣었으니 "다시 붙이지 않기"는 해제한다
    place.photo_blocked = False
    await db.commit()
    await db.refresh(photo)

    photo_url = await get_presigned_url(storage_key)
    thumbnail_url = (
        await get_presigned_url(thumbnail_key) if thumbnail_key else photo_url
    )
    return photo, photo_url, thumbnail_url


async def delete_place_photo(
    db: AsyncSession, place_id: uuid.UUID, user_id: uuid.UUID, block: bool = False
) -> None:
    """@param block 앞으로 이 카드에 사진을 자동으로 붙이지 않는다"""
    place = await _get_place_or_raise(db, place_id, user_id)
    await _tombstone(await _current_photos(db, place, user_id))

    if block:
        place.photo_blocked = True
        # 재분석이 Place를 지우고 다시 만들면 이 플래그도 사라진다
        place.is_corrected = True

    await db.commit()
