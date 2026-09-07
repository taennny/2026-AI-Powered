from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.config import settings

KST = timezone(timedelta(hours=9))


def resolve_tz(tz_name: str | None):
    """IANA 이름 -> tzinfo. 없거나 알 수 없는 이름이면 KST.

    사용자 기기가 보내온 문자열이라 신뢰할 수 없다 — 여기서 막지 않으면
    오타 하나로 분석 전체가 500이 된다.
    """
    if not tz_name:
        return KST
    try:
        return ZoneInfo(tz_name)
    except (ZoneInfoNotFoundError, ValueError):
        return KST


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


def day_bounds(target_date, tz_name: str | None = None) -> tuple[datetime, datetime]:
    """target_date에 해당하는 하루의 [시작, 끝) — DAY_BOUNDARY_HOUR(예: 04:00) 기준, UTC aware로 반환.

    예: DAY_BOUNDARY_HOUR=4, tz_name="Asia/Seoul", target_date=2026-08-06이면
    2026-08-06 04:00 KST ~ 2026-08-07 04:00 KST (배타적) 범위.

    tz_name을 주지 않으면 KST다 — 기존 호출과 국내 기록은 동작이 그대로다.
    앱은 **기기 tz의 04시**로 "오늘"을 정해 그 날짜를 요청하므로, 해외에서는
    그 기록의 tz를 넘겨야 앱이 요청한 날짜와 서버가 자르는 구간이 일치한다.

    서머타임이 있는 지역은 하루가 23/25시간이 되는 날이 있다. "현지 04시 ~
    다음날 현지 04시"를 지킨 결과이며, 의도한 동작이다.
    """
    start = datetime.combine(
        target_date, time(hour=settings.DAY_BOUNDARY_HOUR), tzinfo=resolve_tz(tz_name)
    )
    end = start + timedelta(days=1)
    return start.astimezone(timezone.utc), end.astimezone(timezone.utc)
