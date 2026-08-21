"""여러 날 모아쓰기 테스트 (기간 요청 → payload 구조 / 검증 / 쿼터 / 충돌)."""

import uuid
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, patch

from sqlalchemy import select

from app.config import settings
from app.models.blog import Blog
from app.models.daily_record import DailyRecord
from app.models.place import Place
from tests.conftest import TEST_USER_ID, TestingSessionLocal

# conftest가 기본으로 넣어두는 하루기록의 날짜
BASE_DATE = date(2026, 5, 1)


async def _add_day(target_date: date, place_names: list[str]) -> uuid.UUID:
    """해당 날짜의 daily_record + 장소들을 삽입하고 record id 반환."""
    record_id = uuid.uuid4()
    async with TestingSessionLocal() as db:
        db.add(
            DailyRecord(
                id=record_id,
                user_id=TEST_USER_ID,
                target_date=target_date,
                place_count=len(place_names),
                photo_count=0,
                timezone="Asia/Seoul",
            )
        )
        await db.flush()
        for hour, name in enumerate(place_names, start=1):
            db.add(
                Place(
                    id=uuid.uuid4(),
                    user_id=TEST_USER_ID,
                    daily_record_id=record_id,
                    name=name,
                    category="카페",
                    address="서울",
                    location="POINT(127.0 37.0)",
                    arrived_at=datetime(
                        target_date.year,
                        target_date.month,
                        target_date.day,
                        hour,
                        0,
                        tzinfo=timezone.utc,
                    ),
                    left_at=None,
                )
            )
        await db.commit()
    return record_id


async def _generate_period(client, start: date, end: date):
    return await client.post(
        "/api/v1/blog/generate",
        json={
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "style": "casual",
        },
    )


async def _generate_single(client, daily_record_id):
    return await client.post(
        "/api/v1/blog/generate",
        json={"daily_record_id": str(daily_record_id), "style": "casual"},
    )


async def _capture_payload(client, coro_factory):
    """AI 호출을 가로채 daily_record 인자(= payload)를 반환."""
    fake = AsyncMock(return_value={"title": "t", "content": "c"})
    with patch("app.services.blog.request_blog_generation", fake):
        res = await coro_factory()
    assert res.status_code == 202
    fake.assert_awaited_once()
    return fake.call_args.kwargs["daily_record"]


# ============================================================
# 1. 기간 생성 저장
# ============================================================


async def test_period_blog_saves_start_and_end(client):
    """기간 3일 요청 → 202, target_date=시작일 / period_end=종료일"""
    await _add_day(date(2026, 6, 1), ["가"])
    await _add_day(date(2026, 6, 2), ["나"])
    await _add_day(date(2026, 6, 3), ["다"])

    with patch("app.api.v1.blog.run_blog_generation", new_callable=AsyncMock):
        res = await _generate_period(client, date(2026, 6, 1), date(2026, 6, 3))
    assert res.status_code == 202

    async with TestingSessionLocal() as db:
        blog = await db.get(Blog, uuid.UUID(res.json()["blog_id"]))
        assert blog.target_date == date(2026, 6, 1)
        assert blog.period_end == date(2026, 6, 3)
        assert blog.daily_record_id is None


# ============================================================
# 2. payload 구조 (AI팀 합의 규격)
# ============================================================


async def test_multi_day_payload_structure(client):
    """최상위 date=시작일 + days 배열, 최상위 blocks 없음, seq는 날짜별 1부터"""
    await _add_day(date(2026, 6, 1), ["가", "나"])
    await _add_day(date(2026, 6, 2), ["다"])

    payload = await _capture_payload(
        client, lambda: _generate_period(client, date(2026, 6, 1), date(2026, 6, 2))
    )

    # AI 서버 serialize()가 필수로 읽는 최상위 date는 시작일로 유지된다
    assert payload["date"] == "2026-06-01"
    assert "blocks" not in payload
    assert payload["user"]["nickname"] == "테스트유저"
    # 백엔드가 현지 시각으로 변환해 보내므로 timezone 필드는 넣지 않는다
    assert "timezone" not in payload

    days = payload["days"]
    assert [d["date"] for d in days] == ["2026-06-01", "2026-06-02"]
    assert [b["seq"] for b in days[0]["blocks"]] == [1, 2]
    assert [b["seq"] for b in days[1]["blocks"]] == [1]  # 날짜별로 1부터 재시작
    assert [b["place"] for b in days[0]["blocks"]] == ["가", "나"]


async def test_single_day_payload_unchanged(client, daily_record_id):
    """하루짜리는 기존 형식 그대로 — blocks 있고 days 없음"""
    payload = await _capture_payload(
        client, lambda: _generate_single(client, daily_record_id)
    )

    assert payload["date"] == BASE_DATE.isoformat()
    assert "blocks" in payload
    assert "days" not in payload


async def test_days_without_record_are_skipped(client):
    """기간 중 기록 없는 날은 days에서 빠지고 나머지는 정상"""
    await _add_day(date(2026, 6, 1), ["가"])
    # 6/2는 기록 없음
    await _add_day(date(2026, 6, 3), ["다"])

    payload = await _capture_payload(
        client, lambda: _generate_period(client, date(2026, 6, 1), date(2026, 6, 3))
    )

    assert [d["date"] for d in payload["days"]] == ["2026-06-01", "2026-06-03"]
    assert payload["date"] == "2026-06-01"  # 최상위는 요청 시작일 기준 기록의 첫날


# ============================================================
# 3. 요청 검증
# ============================================================


async def test_period_without_any_record_returns_404(client):
    """기간 전체에 기록이 없으면 404"""
    res = await _generate_period(client, date(2026, 9, 1), date(2026, 9, 3))
    assert res.status_code == 404


async def test_end_before_start_returns_422(client):
    """end_date < start_date → 422"""
    res = await _generate_period(client, date(2026, 6, 5), date(2026, 6, 1))
    assert res.status_code == 422


async def test_both_modes_together_returns_422(client, daily_record_id):
    """daily_record_id와 start_date를 함께 보내면 422"""
    res = await client.post(
        "/api/v1/blog/generate",
        json={
            "daily_record_id": str(daily_record_id),
            "start_date": "2026-06-01",
            "style": "casual",
        },
    )
    assert res.status_code == 422


async def test_neither_mode_returns_422(client):
    """daily_record_id도 기간도 없으면 422"""
    res = await client.post("/api/v1/blog/generate", json={"style": "casual"})
    assert res.status_code == 422


async def test_period_over_max_days_returns_422(client):
    """상한(MAX_BLOG_PERIOD_DAYS) 초과 → 422"""
    start = date(2026, 6, 1)
    end = start.fromordinal(start.toordinal() + settings.MAX_BLOG_PERIOD_DAYS)
    res = await _generate_period(client, start, end)
    assert res.status_code == 422


# ============================================================
# 4. 쿼터 · 중복 요청
# ============================================================


async def test_period_blog_consumes_single_quota(client):
    """여러 날을 묶어도 생성 1회만 소모"""
    await _add_day(date(2026, 6, 1), ["가"])
    await _add_day(date(2026, 6, 2), ["나"])
    await _add_day(date(2026, 6, 3), ["다"])

    with patch("app.api.v1.blog.run_blog_generation", new_callable=AsyncMock):
        res = await _generate_period(client, date(2026, 6, 1), date(2026, 6, 3))
    assert res.status_code == 202

    async with TestingSessionLocal() as db:
        blogs = (
            (await db.execute(select(Blog).where(Blog.user_id == TEST_USER_ID)))
            .scalars()
            .all()
        )
        assert len(blogs) == 1


async def test_same_period_twice_returns_409(client):
    """같은 기간 연타 → 두 번째는 409 (생성 진행 중)"""
    await _add_day(date(2026, 6, 1), ["가"])
    await _add_day(date(2026, 6, 2), ["나"])

    with patch("app.api.v1.blog.run_blog_generation", new_callable=AsyncMock):
        first = await _generate_period(client, date(2026, 6, 1), date(2026, 6, 2))
        second = await _generate_period(client, date(2026, 6, 1), date(2026, 6, 2))

    assert first.status_code == 202
    assert second.status_code == 409
