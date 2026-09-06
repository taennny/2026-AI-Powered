import io
import uuid
from datetime import datetime, timedelta, timezone

import piexif
import pillow_heif
from PIL import Image, ImageOps
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.photos import Photo
from app.services.storage import upload_file, get_presigned_url
from app.utils.timezone import KST

pillow_heif.register_heif_opener()

HEIC_TYPES = {"image/heic", "image/heif"}


def _parse_exif(exif_source: bytes) -> dict:
    """EXIF에서 촬영 시각 추출.

    exif_source는 JPEG 파일 전체 바이트이거나, PIL이 뽑아준 raw EXIF 바이트
    둘 다 가능 (piexif.load가 알아서 구분함).

    OffsetTimeOriginal(촬영지 UTC 오프셋)이 있으면 그 시간대를 쓰고,
    없으면 KST로 간주한다 (기존 폴백 유지 — 한국에서 찍은 사진 다수 대응).
    """
    result = {"taken_at": None}
    try:
        exif_data = piexif.load(exif_source)
        exif_ifd = exif_data.get("Exif", {})
        dt_bytes = exif_ifd.get(piexif.ExifIFD.DateTimeOriginal)
        if dt_bytes:
            dt_str = dt_bytes.decode("utf-8")
            naive_dt = datetime.strptime(dt_str, "%Y:%m:%d %H:%M:%S")
            offset_bytes = exif_ifd.get(piexif.ExifIFD.OffsetTimeOriginal)
            tz = KST
            if offset_bytes:
                offset_str = offset_bytes.decode("utf-8").strip()
                sign = 1 if offset_str.startswith("+") else -1
                hours, minutes = offset_str[1:].split(":")
                tz = timezone(sign * timedelta(hours=int(hours), minutes=int(minutes)))
            result["taken_at"] = naive_dt.replace(tzinfo=tz)
    except Exception:
        pass
    return result


# 썸네일 긴 변 픽셀. 카드가 60px이라 레티나(3배)에서도 또렷하다.
# 키우면 전송량이 다시 늘어난다 — 확대 보기는 원본을 쓰므로 이 값을 올릴 이유가 없다
THUMBNAIL_MAX_PX = 200

# 썸네일 JPEG 품질. 200px에서는 80과 95의 차이가 눈에 안 보이고 용량만 두 배가 된다
THUMBNAIL_QUALITY = 80


def _make_thumbnail(file_bytes: bytes) -> bytes | None:
    """축소본 JPEG 바이트. 실패하면 None — 썸네일 때문에 업로드를 막지 않는다.

    EXIF는 일부러 버린다. 촬영 시각은 이미 원본에서 읽어 DB에 넣었고,
    썸네일에 위치정보를 남기면 노출 경로만 하나 늘어난다.
    """
    try:
        img = Image.open(io.BytesIO(file_bytes))
        # 세로로 찍은 사진이 눕는 것을 막는다 (EXIF Orientation 반영)
        img = ImageOps.exif_transpose(img)
        img.thumbnail((THUMBNAIL_MAX_PX, THUMBNAIL_MAX_PX))

        buf = io.BytesIO()
        img.convert("RGB").save(buf, format="JPEG", quality=THUMBNAIL_QUALITY)
        return buf.getvalue()
    except Exception:
        return None


def _convert_heic_to_jpeg(file_bytes: bytes) -> tuple[bytes, bytes | None]:
    """HEIC/HEIF 바이트를 JPEG로 변환하고, 원본 EXIF 바이트를 같이 반환."""
    img = Image.open(io.BytesIO(file_bytes))
    exif_bytes = img.info.get("exif")

    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="JPEG")
    return buf.getvalue(), exif_bytes


async def upload_photo(
    file_bytes: bytes,
    content_type: str,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> Photo:
    if content_type in HEIC_TYPES:
        file_bytes, exif_bytes = _convert_heic_to_jpeg(file_bytes)
        content_type = "image/jpeg"
        exif = _parse_exif(exif_bytes) if exif_bytes else {"taken_at": None}
    else:
        exif = _parse_exif(file_bytes)

    if exif["taken_at"] is None:
        raise ValueError("촬영 시각 정보가 없는 사진입니다")
    taken_at = exif["taken_at"]

    photo_id = uuid.uuid4()
    ext = "jpg" if "jpeg" in content_type else "png"
    storage_key = f"photos/{user_id}/{photo_id}.{ext}"
    await upload_file(storage_key, file_bytes, content_type)

    # 타임라인 카드는 60px인데 원본은 3~5MB다. 축소본을 같이 만들어 두지 않으면
    # 썸네일 한 칸을 그리려고 원본을 통째로 내려받게 된다.
    thumbnail_key: str | None = None
    thumbnail_bytes = _make_thumbnail(file_bytes)
    if thumbnail_bytes is not None:
        thumbnail_key = f"photos/{user_id}/{photo_id}_thumb.jpg"
        await upload_file(thumbnail_key, thumbnail_bytes, "image/jpeg")

    photo = Photo(
        id=photo_id,
        user_id=user_id,
        storage_key=storage_key,
        thumbnail_key=thumbnail_key,
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
