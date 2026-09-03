"""띄엄띄엄 날짜 선택(dates) 모아쓰기 테스트.

어떤 모드로 요청이 오든 내부에서는 target_dates(실제 기록이 있는 날짜 목록)로
통일해 저장되는지를 검증한다.
"""

import uuid
from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

from app.config import settings
from app.models.blog import Blog
from app.models.daily_record import DailyRecord
from app.models.place import Place
from tests.conftest import TEST_USER_ID, TestingSessionLocal


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


async def _generate_dates(client, dates: list[str]):
    return await client.post(
        "/api/v1/blog/generate",
        json={"dates": dates, "style": "casual"},
    )


async def _generate_period(client, start: date, end: date):
    return await client.post(
        "/api/v1/blog/generate",
        json={
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "style": "casual",
        },
    )


async def _fetch_blog(blog_id: str) -> Blog:
    async with TestingSessionLocal() as db:
        return await db.get(Blog, uuid.UUID(blog_id))


# ============================================================
# 1. dates 저장
# ============================================================


async def test_dates_saves_target_dates(client):
    """띄엄띄엄 3일 요청 → 202, target_dates에 고른 날짜 그대로"""
    for d in (3, 5, 7):
        await _add_day(date(2026, 8, d), ["가"])
    # 안 고른 날에도 기록은 있다 — 목록에 섞여 들어오면 안 된다
    await _add_day(date(2026, 8, 4), ["나"])

    with patch("app.api.v1.blog.run_blog_generation", new_callable=AsyncMock):
        res = await _generate_dates(client, ["2026-08-03", "2026-08-05", "2026-08-07"])
    assert res.status_code == 202

    blog = await _fetch_blog(res.json()["blog_id"])
    assert blog.target_dates == ["2026-08-03", "2026-08-05", "2026-08-07"]
    assert blog.target_date == date(2026, 8, 3)
    assert blog.period_end == date(2026, 8, 7)
    assert blog.daily_record_id is None


async def test_period_saves_only_recorded_dates(client):
    """구간 요청 → target_dates는 그 범위 중 기록이 있는 날만"""
    await _add_day(date(2026, 6, 1), ["가"])
    # 6/2는 기록 없음
    await _add_day(date(2026, 6, 3), ["다"])

    with patch("app.api.v1.blog.run_blog_generation", new_callable=AsyncMock):
        res = await _generate_period(client, date(2026, 6, 1), date(2026, 6, 4))
    assert res.status_code == 202

    blog = await _fetch_blog(res.json()["blog_id"])
    assert blog.target_dates == ["2026-06-01", "2026-06-03"]
    # 기록이 있는 날짜의 최소·최대가 표시용 시작·종료일이 된다
    assert blog.target_date == date(2026, 6, 1)
    assert blog.period_end == date(2026, 6, 3)


async def test_duplicate_and_unsorted_dates_are_normalized(client):
    """중복·역순으로 보내도 중복 제거 + 오름차순으로 저장"""
    for d in (3, 5, 7):
        await _add_day(date(2026, 8, d), ["가"])

    with patch("app.api.v1.blog.run_blog_generation", new_callable=AsyncMock):
        res = await _generate_dates(
            client,
            ["2026-08-07", "2026-08-03", "2026-08-05", "2026-08-03"],
        )
    assert res.status_code == 202

    blog = await _fetch_blog(res.json()["blog_id"])
    assert blog.target_dates == ["2026-08-03", "2026-08-05", "2026-08-07"]


# ============================================================
# 2. 요청 검증
# ============================================================


async def test_empty_dates_returns_422(client):
    """빈 배열 → 422"""
    res = await _generate_dates(client, [])
    assert res.status_code == 422


async def test_dates_over_max_returns_422(client):
    """중복 제거 후 개수가 상한 초과 → 422"""
    start = date(2026, 6, 1)
    dates = [
        (start + timedelta(days=i)).isoformat()
        for i in range(settings.MAX_BLOG_PERIOD_DAYS + 1)
    ]
    res = await _generate_dates(client, dates)
    assert res.status_code == 422


async def test_dates_with_daily_record_id_returns_422(client, daily_record_id):
    """dates + daily_record_id → 422"""
    res = await client.post(
        "/api/v1/blog/generate",
        json={
            "daily_record_id": str(daily_record_id),
            "dates": ["2026-08-03"],
            "style": "casual",
        },
    )
    assert res.status_code == 422


async def test_dates_with_period_returns_422(client):
    """dates + start_date/end_date → 422"""
    res = await client.post(
        "/api/v1/blog/generate",
        json={
            "dates": ["2026-08-03"],
            "start_date": "2026-08-01",
            "end_date": "2026-08-05",
            "style": "casual",
        },
    )
    assert res.status_code == 422

    # start_date만 섞여도 마찬가지로 거절
    res = await client.post(
        "/api/v1/blog/generate",
        json={
            "dates": ["2026-08-03"],
            "start_date": "2026-08-01",
            "style": "casual",
        },
    )
    assert res.status_code == 422


async def test_dates_without_any_record_returns_404(client):
    """고른 날짜에 기록이 하나도 없으면 404"""
    res = await _generate_dates(client, ["2026-09-01", "2026-09-05"])
    assert res.status_code == 404


async def test_same_dates_twice_returns_409(client):
    """같은 날짜 목록 연타 → 두 번째는 409"""
    for d in (3, 5):
        await _add_day(date(2026, 8, d), ["가"])

    with patch("app.api.v1.blog.run_blog_generation", new_callable=AsyncMock):
        first = await _generate_dates(client, ["2026-08-03", "2026-08-05"])
        second = await _generate_dates(client, ["2026-08-03", "2026-08-05"])

    assert first.status_code == 202
    assert second.status_code == 409


# ============================================================
# 3. AI payload
# ============================================================


async def test_ai_payload_follows_target_dates(client):
    """days가 target_dates 순서와 일치하고 최상위 date는 첫 날짜"""
    for d in (3, 5, 7):
        await _add_day(date(2026, 8, d), ["가"])
    await _add_day(date(2026, 8, 4), ["나"])  # 안 고른 날

    fake = AsyncMock(return_value={"title": "t", "content": "c"})
    with patch("app.services.blog.request_blog_generation", fake):
        res = await _generate_dates(client, ["2026-08-03", "2026-08-05", "2026-08-07"])
    assert res.status_code == 202
    fake.assert_awaited_once()

    payload = fake.call_args.kwargs["daily_record"]
    assert payload["date"] == "2026-08-03"
    assert [d["date"] for d in payload["days"]] == [
        "2026-08-03",
        "2026-08-05",
        "2026-08-07",
    ]
    assert "blocks" not in payload
    assert [b["seq"] for b in payload["days"][0]["blocks"]] == [1]


# ============================================================
# 4. 응답 노출
# ============================================================


async def test_responses_expose_dates(client):
    """상세·목록 응답에 dates 포함"""
    for d in (3, 5):
        await _add_day(date(2026, 8, d), ["가"])

    with patch("app.api.v1.blog.run_blog_generation", new_callable=AsyncMock):
        res = await _generate_dates(client, ["2026-08-03", "2026-08-05"])
    blog_id = res.json()["blog_id"]

    detail = await client.get(f"/api/v1/blog/{blog_id}")
    assert detail.status_code == 200
    assert detail.json()["dates"] == ["2026-08-03", "2026-08-05"]

    listed = await client.get("/api/v1/blogs")
    assert listed.status_code == 200
    item = next(b for b in listed.json()["blogs"] if b["id"] == blog_id)
    assert item["dates"] == ["2026-08-03", "2026-08-05"]


async def test_single_day_blog_has_null_dates(client, daily_record_id):
    """기존 하루짜리 요청은 동작 그대로 + dates는 null"""
    with patch("app.api.v1.blog.run_blog_generation", new_callable=AsyncMock):
        res = await client.post(
            "/api/v1/blog/generate",
            json={"daily_record_id": str(daily_record_id), "style": "casual"},
        )
    assert res.status_code == 202
    blog_id = res.json()["blog_id"]

    blog = await _fetch_blog(blog_id)
    assert blog.target_dates is None
    assert blog.daily_record_id == daily_record_id
    assert blog.period_end is None

    detail = await client.get(f"/api/v1/blog/{blog_id}")
    assert detail.json()["dates"] is None

    listed = await client.get("/api/v1/blogs")
    item = next(b for b in listed.json()["blogs"] if b["id"] == blog_id)
    assert item["dates"] is None
