"""DailyRecord + 장소 → AI 서버가 기대하는 timeline_data 직렬화.

AI 서버(/generate)의 serialize()는 각 block에서
seq / start / end / place / category / address 를 필수로 읽고,
expense / photos / memo 는 없으면 알아서 생략 처리한다.
"""

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


def map_style(style: str) -> str:
    """블로그 스타일 값을 AI 서버가 받는 어휘로 변환. 미매칭은 casual."""
    return _STYLE_MAP.get(style, "casual")


def build_timeline_data(
    daily_record: DailyRecord,
    user: User,
    places: list[Place],
) -> dict:
    """AI 서버 /generate가 기대하는 timeline_data 구조로 직렬화."""
    blocks = [
        {
            "seq": seq,
            "start": place.arrived_at.strftime("%H:%M") if place.arrived_at else "",
            "end": place.left_at.strftime("%H:%M") if place.left_at else "",
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
