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


def _build_blocks(daily_record: DailyRecord, places: list[Place]) -> list[dict]:
    """하루치 장소 목록을 blocks로 변환. seq는 그 날 안에서 1부터 시작한다."""
    tz = _resolve_timezone(daily_record.timezone)
    return [
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


def _build_user(user: User) -> dict:
    """AI 서버가 읽는 user 블록. 여러 날 payload에서도 최상위에 한 번만 들어간다."""
    return {
        "nickname": user.nickname,
        "taste_tags": [],
    }


def build_timeline_data(
    daily_record: DailyRecord,
    user: User,
    places: list[Place],
) -> dict:
    """AI 서버 /generate가 기대하는 timeline_data 구조로 직렬화 (하루짜리)."""
    return {
        "date": daily_record.target_date.isoformat(),
        "user": _build_user(user),
        "blocks": _build_blocks(daily_record, places),
    }


def build_multi_day_timeline_data(
    days_data: list[tuple[DailyRecord, list[Place]]],
    user: User,
) -> dict:
    """여러 날을 한 편으로 묶는 payload (모아쓰기).

    AI팀 합의 규격:
      - `days` 배열에 날짜별 {date, blocks}를 담고, 최상위 `blocks`는 넣지 않는다.
      - `user`는 최상위에 한 번만 둔다.
      - `timezone` 필드는 넣지 않는다 (여기서 이미 현지 시각으로 변환해 보내므로).
      - seq는 날짜별로 1부터 다시 시작한다.

    최상위 `date`(시작일)를 여러 날일 때도 유지하는 이유:
    AI 서버 serialize()가 `data['date']`를 필수 키로 읽기 때문에,
    AI팀이 days 지원을 넣기 전에 백엔드가 먼저 배포돼도 KeyError로 죽지 않게 하는 안전장치다.
    (그 덕분에 양쪽 배포 순서를 맞출 필요가 없다)

    days_data는 날짜 오름차순으로 정렬돼 있어야 하며, 기록이 없는 날은 호출 측에서 제외한다.
    """
    days = [
        {
            "date": daily_record.target_date.isoformat(),
            "blocks": _build_blocks(daily_record, places),
        }
        for daily_record, places in days_data
    ]

    return {
        "date": days[0]["date"],
        "user": _build_user(user),
        "days": days,
    }
