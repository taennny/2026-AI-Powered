import uuid
from datetime import datetime, timezone

import piexif
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.photos import Photo
from app.services.storage import upload_file, get_presigned_url


def _parse_exif(file_bytes: bytes) -> dict:
    """EXIF에서 촬영 시각과 GPS 좌표 추출"""
    result = {"taken_at": None, "latitude": None, "longitude": None}

    try:
        exif_data = piexif.load(file_bytes)

        # 촬영 시각
        exif_ifd = exif_data.get("Exif", {})
        dt_bytes = exif_ifd.get(piexif.ExifIFD.DateTimeOriginal)
        if dt_bytes:
            dt_str = dt_bytes.decode("utf-8")
            result["taken_at"] = datetime.strptime(dt_str, "%Y:%m:%d %H:%M:%S").replace(
                tzinfo=timezone.utc
            )

        # GPS 좌표
        gps_ifd = exif_data.get("GPS", {})
        if gps_ifd:

            def to_degrees(values):
                d, m, s = values
                return d[0] / d[1] + m[0] / m[1] / 60 + s[0] / s[1] / 3600

            lat_val = gps_ifd.get(piexif.GPSIFD.GPSLatitude)
            lat_ref = gps_ifd.get(piexif.GPSIFD.GPSLatitudeRef)
            lng_val = gps_ifd.get(piexif.GPSIFD.GPSLongitude)
            lng_ref = gps_ifd.get(piexif.GPSIFD.GPSLongitudeRef)

            if lat_val and lng_val:
                lat = to_degrees(lat_val)
                lng = to_degrees(lng_val)
                if lat_ref and lat_ref.decode() == "S":
                    lat = -lat
                if lng_ref and lng_ref.decode() == "W":
                    lng = -lng
                result["latitude"] = lat
                result["longitude"] = lng

    except Exception:
        pass  # EXIF 없거나 파싱 실패해도 그냥 None으로

    return result


async def upload_photo(
    file_bytes: bytes,
    content_type: str,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> Photo:
    exif = _parse_exif(file_bytes)

    # EXIF 촬영 시각 없으면 업로드 시간 사용
    taken_at = exif["taken_at"] or datetime.now(timezone.utc)

    # B의 storage 서비스로 MinIO 저장
    photo_id = uuid.uuid4()
    ext = "jpg" if "jpeg" in content_type else "png"
    storage_key = f"photos/{user_id}/{photo_id}.{ext}"
    await upload_file(storage_key, file_bytes, content_type)

    # DB 저장
    photo = Photo(
        id=photo_id,
        user_id=user_id,
        storage_key=storage_key,
        taken_at=taken_at,
        latitude=exif["latitude"],
        longitude=exif["longitude"],
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
