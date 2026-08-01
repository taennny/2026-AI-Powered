import uuid
from datetime import datetime, timezone

import piexif
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.photos import Photo
from app.services.storage import upload_file, get_presigned_url
from app.utils.timezone import KST


def _parse_exif(file_bytes: bytes) -> dict:
    """EXIF에서 촬영 시각 추출"""
    result = {"taken_at": None}

    try:
        exif_data = piexif.load(file_bytes)

        exif_ifd = exif_data.get("Exif", {})
        dt_bytes = exif_ifd.get(piexif.ExifIFD.DateTimeOriginal)
        if dt_bytes:
            dt_str = dt_bytes.decode("utf-8")
            result["taken_at"] = datetime.strptime(dt_str, "%Y:%m:%d %H:%M:%S").replace(
                tzinfo=KST
            )

    except Exception:
        pass

    return result


async def upload_photo(
    file_bytes: bytes,
    content_type: str,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> Photo:
    exif = _parse_exif(file_bytes)

    taken_at = exif["taken_at"] or datetime.now(timezone.utc)

    photo_id = uuid.uuid4()
    ext = "jpg" if "jpeg" in content_type else "png"
    storage_key = f"photos/{user_id}/{photo_id}.{ext}"
    await upload_file(storage_key, file_bytes, content_type)

    photo = Photo(
        id=photo_id,
        user_id=user_id,
        storage_key=storage_key,
        taken_at=taken_at,
    )
    db.add(photo)
    await db.commit()
    await db.refresh(photo)

    return photo


async def get_photo(
    photo_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession
) -> Photo | None:
    result = await db.execute(
        select(Photo).where(Photo.id == photo_id, Photo.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def get_photo_url(storage_key: str) -> str:
    return await get_presigned_url(storage_key)
