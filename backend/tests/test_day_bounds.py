"""하루 경계(04:00)를 어느 시간대로 자르는지.

앱은 **기기 tz의 04시**로 "오늘"을 정하고 그 날짜를 서버에 요청한다.
서버가 KST로만 자르면 해외 사용자는 요청한 날짜와 다른 구간을 받는다 —
뉴욕이면 현지 오후 3시에 날짜가 바뀌어 저녁 기록이 다음 날 칸으로 넘어간다.
"""

from datetime import date, datetime, timedelta, timezone

from app.utils.timezone import KST, day_bounds, resolve_tz


def _hours(start: datetime, end: datetime) -> float:
    return (end - start).total_seconds() / 3600


def test_default_is_kst():
    """tz를 안 주면 예전과 똑같이 KST 04시 — 기존 호출부가 안 깨진다"""
    start, end = day_bounds(date(2026, 8, 6))

    assert start == datetime(2026, 8, 6, 4, tzinfo=KST).astimezone(timezone.utc)
    assert _hours(start, end) == 24


def test_overseas_tz_cuts_at_local_four():
    """뉴욕이면 현지 04시 기준 — UTC로는 09:00(EDT, UTC-4)"""
    start, end = day_bounds(date(2026, 8, 6), "America/New_York")

    assert start == datetime(2026, 8, 6, 8, tzinfo=timezone.utc)
    assert end == datetime(2026, 8, 7, 8, tzinfo=timezone.utc)


def test_overseas_differs_from_kst():
    """같은 날짜라도 시간대가 다르면 구간이 다르다 — 이게 안 되면 고친 의미가 없다"""
    kst_start, _ = day_bounds(date(2026, 8, 6))
    ny_start, _ = day_bounds(date(2026, 8, 6), "America/New_York")

    assert kst_start != ny_start


def test_unknown_tz_falls_back_to_kst():
    """기기가 보내온 문자열이라 신뢰할 수 없다 — 오타 하나로 500이 나면 안 된다"""
    start, end = day_bounds(date(2026, 8, 6), "Not/AZone")

    assert (start, end) == day_bounds(date(2026, 8, 6))


def test_empty_tz_falls_back_to_kst():
    start, _ = day_bounds(date(2026, 8, 6), "")

    assert start == day_bounds(date(2026, 8, 6))[0]


# 서머타임이 있는 지역은 하루가 24시간이 아닌 날이 생긴다.
# "현지 04시 ~ 다음날 현지 04시"를 지키는 것이 맞는 동작이라 값을 못 박아 둔다.
def test_dst_spring_forward_day_is_23_hours():
    """미국 서머타임 시작(2026-03-08 02:00)을 품은 하루 = 23시간"""
    start, end = day_bounds(date(2026, 3, 7), "America/New_York")

    assert _hours(start, end) == 23


def test_dst_fall_back_day_is_25_hours():
    """서머타임 종료(2026-11-01 02:00)를 품은 하루 = 25시간"""
    start, end = day_bounds(date(2026, 10, 31), "America/New_York")

    assert _hours(start, end) == 25


def test_bounds_are_contiguous_across_days():
    """어제의 끝과 오늘의 시작이 맞물린다 — 벌어지면 그 사이 기록이 사라진다"""
    _, yesterday_end = day_bounds(date(2026, 8, 5), "Europe/Paris")
    today_start, _ = day_bounds(date(2026, 8, 6), "Europe/Paris")

    assert yesterday_end == today_start


def test_resolve_tz_returns_kst_for_none():
    assert resolve_tz(None) is KST


def test_resolve_tz_keeps_valid_name():
    tz = resolve_tz("Asia/Tokyo")

    assert tz.utcoffset(datetime(2026, 8, 6)) == timedelta(hours=9)
