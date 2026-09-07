"""장소가 어느 지역 시각으로 표시될지 — 그 체류 구간 GPS 로그의 시간대에서 정한다.

`daily_records.timezone`은 하루에 하나뿐이라 비행기 탄 날을 표현할 수 없다.
서울에서 출발해 LA에 도착한 날, 도착지 장소가 서울 시각으로 그려지면
"오후 8시에 LA 도착"처럼 사용자 기억과 안 맞는 기록이 남는다.
"""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.services.ai import _as_utc, _stay_timezone

KST = timezone(timedelta(hours=9))
PDT = timezone(timedelta(hours=-7))


def _log(recorded_at, tz_name):
    return SimpleNamespace(recorded_at=recorded_at, timezone=tz_name)


def test_uses_timezone_of_log_inside_the_stay():
    logs = [
        _log(datetime(2026, 9, 6, 1, tzinfo=timezone.utc), "Asia/Seoul"),
        _log(datetime(2026, 9, 6, 12, tzinfo=timezone.utc), "America/Los_Angeles"),
    ]

    tz = _stay_timezone(
        logs,
        datetime(2026, 9, 6, 11, tzinfo=timezone.utc),
        datetime(2026, 9, 6, 13, tzinfo=timezone.utc),
    )

    assert tz == "America/Los_Angeles"


# 같은 하루 안에서 두 장소가 서로 다른 tz를 갖는 것이 이 기능의 전부다
def test_two_stays_in_one_day_can_differ():
    logs = [
        _log(datetime(2026, 9, 6, 1, tzinfo=timezone.utc), "Asia/Seoul"),
        _log(datetime(2026, 9, 6, 12, tzinfo=timezone.utc), "America/Los_Angeles"),
    ]

    departure = _stay_timezone(
        logs,
        datetime(2026, 9, 6, 0, tzinfo=timezone.utc),
        datetime(2026, 9, 6, 2, tzinfo=timezone.utc),
    )
    arrival = _stay_timezone(
        logs,
        datetime(2026, 9, 6, 11, tzinfo=timezone.utc),
        datetime(2026, 9, 6, 13, tzinfo=timezone.utc),
    )

    assert departure == "Asia/Seoul"
    assert arrival == "America/Los_Angeles"


def test_returns_none_when_no_log_in_range():
    """구간에 걸린 로그가 없으면 None — 읽는 쪽이 그날의 tz로 폴백한다"""
    logs = [_log(datetime(2026, 9, 6, 1, tzinfo=timezone.utc), "Asia/Seoul")]

    tz = _stay_timezone(
        logs,
        datetime(2026, 9, 6, 20, tzinfo=timezone.utc),
        datetime(2026, 9, 6, 21, tzinfo=timezone.utc),
    )

    assert tz is None


def test_ignores_logs_without_timezone():
    """이 컬럼이 생기기 전에 쌓인 로그는 tz가 없다 — 건너뛰고 다음 로그를 본다"""
    logs = [
        _log(datetime(2026, 9, 6, 1, tzinfo=timezone.utc), None),
        _log(datetime(2026, 9, 6, 2, tzinfo=timezone.utc), "Asia/Seoul"),
    ]

    tz = _stay_timezone(
        logs,
        datetime(2026, 9, 6, 0, tzinfo=timezone.utc),
        datetime(2026, 9, 6, 3, tzinfo=timezone.utc),
    )

    assert tz == "Asia/Seoul"


def test_all_logs_without_timezone_returns_none():
    logs = [_log(datetime(2026, 9, 6, 1, tzinfo=timezone.utc), None)]

    tz = _stay_timezone(
        logs,
        datetime(2026, 9, 6, 0, tzinfo=timezone.utc),
        datetime(2026, 9, 6, 3, tzinfo=timezone.utc),
    )

    assert tz is None


# AI 응답의 시각에 tz가 안 붙어 오면, naive와 aware를 비교하다 TypeError로 죽는다
def test_naive_stay_times_are_treated_as_utc():
    logs = [_log(datetime(2026, 9, 6, 1, tzinfo=timezone.utc), "Asia/Seoul")]

    tz = _stay_timezone(logs, datetime(2026, 9, 6, 0), datetime(2026, 9, 6, 3))

    assert tz == "Asia/Seoul"


def test_naive_log_times_are_treated_as_utc():
    """SQLite 등에서 naive로 올라오는 경우"""
    logs = [_log(datetime(2026, 9, 6, 1), "Asia/Seoul")]

    tz = _stay_timezone(
        logs,
        datetime(2026, 9, 6, 0, tzinfo=timezone.utc),
        datetime(2026, 9, 6, 3, tzinfo=timezone.utc),
    )

    assert tz == "Asia/Seoul"


def test_boundaries_are_inclusive():
    """체류 시작·끝 시각에 정확히 걸린 로그도 그 체류의 것이다"""
    logs = [_log(datetime(2026, 9, 6, 5, tzinfo=timezone.utc), "Asia/Seoul")]

    tz = _stay_timezone(
        logs,
        datetime(2026, 9, 6, 5, tzinfo=timezone.utc),
        datetime(2026, 9, 6, 5, tzinfo=timezone.utc),
    )

    assert tz == "Asia/Seoul"


def test_as_utc_normalizes_offsets():
    """서로 다른 오프셋으로 들어와도 같은 순간이면 같게 본다"""
    seoul = datetime(2026, 9, 6, 18, tzinfo=KST)
    la = datetime(2026, 9, 6, 2, tzinfo=PDT)

    assert _as_utc(seoul) == _as_utc(la)
