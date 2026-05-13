from datetime import datetime, timezone
from typing import Any

from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS


def _get_exif_raw(image: Image.Image) -> dict[str, Any]:
    raw = image._getexif()  # type: ignore[attr-defined]
    if not raw:
        return {}
    return {TAGS.get(k, k): v for k, v in raw.items()}


def _dms_to_decimal(dms: tuple, ref: str) -> float:
    """도/분/초 → 소수점 좌표 변환."""
    d, m, s = dms
    decimal = float(d) + float(m) / 60 + float(s) / 3600
    if ref in ("S", "W"):
        decimal = -decimal
    return round(decimal, 7)


def _parse_gps(gps_info: dict) -> tuple[float | None, float | None]:
    tagged = {GPSTAGS.get(k, k): v for k, v in gps_info.items()}
    try:
        lat = _dms_to_decimal(tagged["GPSLatitude"], tagged["GPSLatitudeRef"])
        lon = _dms_to_decimal(tagged["GPSLongitude"], tagged["GPSLongitudeRef"])
        return lat, lon
    except (KeyError, TypeError, ZeroDivisionError):
        return None, None


def _parse_taken_at(exif: dict) -> datetime | None:
    raw = exif.get("DateTimeOriginal") or exif.get("DateTime")
    if not raw:
        return None
    try:
        dt = datetime.strptime(raw, "%Y:%m:%d %H:%M:%S")
        return dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def parse(image: Image.Image) -> dict[str, Any]:
    """Returns {"taken_at": datetime|None, "latitude": float|None, "longitude": float|None}."""
    try:
        exif = _get_exif_raw(image)
    except Exception:
        return {"taken_at": None, "latitude": None, "longitude": None}

    taken_at = _parse_taken_at(exif)
    lat, lon = None, None

    gps_raw = exif.get("GPSInfo")
    if isinstance(gps_raw, dict):
        lat, lon = _parse_gps(gps_raw)

    return {"taken_at": taken_at, "latitude": lat, "longitude": lon}
