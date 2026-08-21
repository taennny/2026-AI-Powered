from datetime import timedelta

import piexif
from PIL import Image
import io

from app.services.photos import _parse_exif


def _make_jpeg_with_exif(date_str: str, offset_str: str | None) -> bytes:
    """테스트용 가짜 JPEG 바이트 생성 (EXIF 포함)"""
    img = Image.new("RGB", (10, 10), color="white")
    buf = io.BytesIO()
    img.save(buf, format="jpeg")
    jpeg_bytes = buf.getvalue()

    exif_ifd = {piexif.ExifIFD.DateTimeOriginal: date_str.encode("utf-8")}
    if offset_str:
        exif_ifd[piexif.ExifIFD.OffsetTimeOriginal] = offset_str.encode("utf-8")

    exif_dict = {"Exif": exif_ifd}
    exif_bytes = piexif.dump(exif_dict)

    output = io.BytesIO()
    piexif.insert(exif_bytes, jpeg_bytes, output)
    return output.getvalue()


def test_exif_with_offset_time_original():
    """OffsetTimeOriginal 있으면 그 오프셋 그대로 반영"""
    jpeg = _make_jpeg_with_exif("2026:07:01 10:30:00", "-05:00")
    result = _parse_exif(jpeg)

    taken_at = result["taken_at"]
    assert taken_at is not None
    assert taken_at.hour == 10
    assert taken_at.minute == 30
    assert taken_at.utcoffset() == timedelta(hours=-5)


def test_exif_without_offset_time_original_falls_back_to_kst():
    """OffsetTimeOriginal 없으면 KST로 폴백"""
    jpeg = _make_jpeg_with_exif("2026:07:01 10:30:00", None)
    result = _parse_exif(jpeg)

    taken_at = result["taken_at"]
    assert taken_at is not None
    assert taken_at.utcoffset() == timedelta(hours=9)


def test_exif_with_positive_offset():
    """양수 오프셋(+09:00 등)도 정상 파싱"""
    jpeg = _make_jpeg_with_exif("2026:07:01 10:30:00", "+02:00")
    result = _parse_exif(jpeg)

    taken_at = result["taken_at"]
    assert taken_at.utcoffset() == timedelta(hours=2)
