from datetime import datetime, time, timedelta, timezone

from app.config import settings

KST = timezone(timedelta(hours=9))


def week_bounds(now: datetime | None = None) -> tuple[datetime, datetime]:
    """현재 시각이 속한 주의 [시작, 끝) — 월요일 04:00 KST 기준, UTC aware로 반환.

    하루 경계가 새벽 4시이므로 04:00 이전은 전날로 취급한다.
    (예: 화요일 02:00은 아직 월요일이 시작한 그 주)

    now는 테스트에서 시각 주입용. naive datetime은 KST로 간주한다.
    """
    if now is None:
        now = datetime.now(KST)
    elif now.tzinfo is None:
        now = now.replace(tzinfo=KST)
    else:
        now = now.astimezone(KST)

    # 경계 시각만큼 당기면 "04:00 이전 = 전날" 규칙이 날짜 계산에 그대로 반영된다
    shifted = now - timedelta(hours=settings.DAY_BOUNDARY_HOUR)
    monday = shifted.date() - timedelta(days=shifted.weekday())

    start = datetime.combine(monday, time(hour=settings.DAY_BOUNDARY_HOUR), tzinfo=KST)
    end = start + timedelta(days=7)
    return start.astimezone(timezone.utc), end.astimezone(timezone.utc)
