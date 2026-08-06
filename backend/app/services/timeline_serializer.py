"""DailyRecord + 장소 → AI 서버가 기대하는 timeline_data 직렬화.

AI 서버(/generate)의 serialize()는 각 block에서
seq / start / end / place / category / address 를 필수로 읽고,
expense / photos / memo 는 없으면 알아서 생략 처리한다.
"""

from datetime import datetime
from zoneinfo import ZoneInfo

from app.models.daily_record import DailyRecord
from app.models.place import Place
from app.models.user import User

# 블로그 스타일 값(프론트/내부) → AI 서버 어휘(casual/emotional/info) 매핑
_STYLE_MAP = {
    "info": "info",
    "formal": "info",
    "emotion": "emotional",
    "emotional": "emotional",
    "casual": "casual",
    "travel": "casual",
}


DEFAULT_TIMEZONE = "Asia/Seoul"


def map_style(style: str) -> str:
    """블로그 스타일 값을 AI 서버가 받는 어휘로 변환. 미매칭은 casual."""
    return _STYLE_MAP.get(style, "casual")


def _local_hhmm(dt: datetime | None, tz: ZoneInfo) -> str:
    """UTC로 저장된 시각을 그날의 현지 시각 HH:MM으로. AI 글의 시간 표현에 쓰인다."""
    if dt is None:
        return ""
    if dt.tzinfo is None:  # SQLite 등에서 naive로 올라오면 UTC로 간주
        dt = dt.replace(tzinfo=ZoneInfo("UTC"))
    return dt.astimezone(tz).strftime("%H:%M")


def _resolve_timezone(name: str | None) -> ZoneInfo:
    """기록의 타임존 이름을 해석. 없거나 알 수 없으면 기본값."""
    try:
        return ZoneInfo(name or DEFAULT_TIMEZONE)
    except Exception:
        return ZoneInfo(DEFAULT_TIMEZONE)


def build_timeline_data(
    daily_record: DailyRecord,
    user: User,
    places: list[Place],
) -> dict:
    """AI 서버 /generate가 기대하는 timeline_data 구조로 직렬화."""
    tz = _resolve_timezone(daily_record.timezone)
    blocks = [
        {
            "seq": seq,
            "start": _local_hhmm(place.arrived_at, tz),
            "end": _local_hhmm(place.left_at, tz),
            "place": place.name,
            "category": place.category or "기타",
            "address": place.address or "",
        }
        for seq, place in enumerate(places, start=1)
    ]

    return {
        "date": daily_record.target_date.isoformat(),
        "user": {
            "nickname": user.nickname,
            "taste_tags": [],
        },
        "blocks": blocks,
    }
