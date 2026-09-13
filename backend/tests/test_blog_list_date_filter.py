"""목록 날짜 필터 — 모아쓰기 글도 담긴 날짜로 찾힌다.

캘린더에서 날짜를 고르면 그날 글로 바로 가는 버튼이 있는데, 모아쓰기 글은
target_date가 시작일이라 중간 날짜로는 찾지 못했다.
"""

from datetime import date

from app.models.blog import Blog
from app.models.enums import GenerationStatus
from tests.conftest import TEST_USER_ID, TestingSessionLocal


async def _make_blog(db, title, target_date, period_end=None, target_dates=None):
    blog = Blog(
        user_id=TEST_USER_ID,
        title=title,
        content="본문",
        style="casual",
        target_date=target_date,
        period_end=period_end,
        target_dates=target_dates,
        generation_status=GenerationStatus.COMPLETED,
    )
    db.add(blog)
    await db.commit()
    return blog


async def _titles(client, day):
    res = await client.get(f"/api/v1/blogs?date={day}")
    assert res.status_code == 200
    return [b["title"] for b in res.json()["blogs"]]


async def test_single_day_blog_found_by_its_date(client):
    """하루짜리 글은 기존대로 그 날짜로 찾힌다"""
    async with TestingSessionLocal() as db:
        await _make_blog(db, "하루글", date(2026, 8, 5))

    assert await _titles(client, "2026-08-05") == ["하루글"]
    assert await _titles(client, "2026-08-06") == []


async def test_multi_day_blog_found_by_middle_date(client):
    """모아쓰기 글은 시작일이 아닌 중간 날짜로도 찾힌다 (이번 요청의 핵심)"""
    async with TestingSessionLocal() as db:
        await _make_blog(
            db,
            "모아쓴글",
            date(2026, 8, 3),
            period_end=date(2026, 8, 7),
            target_dates=["2026-08-03", "2026-08-05", "2026-08-07"],
        )

    assert await _titles(client, "2026-08-03") == ["모아쓴글"]  # 시작일
    assert await _titles(client, "2026-08-05") == ["모아쓴글"]  # 중간
    assert await _titles(client, "2026-08-07") == ["모아쓴글"]  # 마지막


async def test_unselected_day_in_range_not_found(client):
    """구간 안이지만 글에 담기지 않은 날은 나오지 않는다 — 캘린더 점 표시와 같은 기준"""
    async with TestingSessionLocal() as db:
        await _make_blog(
            db,
            "모아쓴글",
            date(2026, 8, 3),
            period_end=date(2026, 8, 7),
            target_dates=["2026-08-03", "2026-08-07"],
        )

    assert await _titles(client, "2026-08-05") == []


async def test_legacy_multi_day_blog_uses_period_end(client):
    """target_dates 도입 전 글은 period_end 범위로 해석한다"""
    async with TestingSessionLocal() as db:
        await _make_blog(
            db,
            "옛날모아쓴글",
            date(2026, 7, 1),
            period_end=date(2026, 7, 5),
            target_dates=None,
        )

    assert await _titles(client, "2026-07-03") == ["옛날모아쓴글"]
    assert await _titles(client, "2026-07-06") == []


async def test_other_users_blog_not_leaked(client):
    """target_dates는 날짜만 담고 있어 사용자 조건이 빠지면 남의 글이 샌다"""
    import uuid

    async with TestingSessionLocal() as db:
        blog = Blog(
            user_id=uuid.uuid4(),  # 남의 글
            title="남의글",
            content="본문",
            style="casual",
            target_date=date(2026, 8, 3),
            period_end=date(2026, 8, 7),
            target_dates=["2026-08-05"],
            generation_status=GenerationStatus.COMPLETED,
        )
        db.add(blog)
        await db.commit()

    assert await _titles(client, "2026-08-05") == []


async def test_deleted_blog_not_found(client):
    """삭제한 글은 날짜 검색에도 안 나온다"""
    from datetime import datetime, timezone

    async with TestingSessionLocal() as db:
        blog = await _make_blog(
            db,
            "지운글",
            date(2026, 8, 3),
            period_end=date(2026, 8, 7),
            target_dates=["2026-08-05"],
        )
        blog.deleted_at = datetime.now(timezone.utc)
        await db.commit()

    assert await _titles(client, "2026-08-05") == []


async def test_legacy_blog_with_column_omitted(client):
    """컬럼을 아예 넣지 않은 글(SQL NULL)도 period_end 범위로 찾힌다.

    파이썬 None을 명시하면 JSON null이 되어 저장 형태가 달라지므로 둘 다 확인한다.
    """
    async with TestingSessionLocal() as db:
        blog = Blog(
            user_id=TEST_USER_ID,
            title="컬럼없는옛날글",
            content="본문",
            style="casual",
            target_date=date(2026, 6, 1),
            period_end=date(2026, 6, 4),
            generation_status=GenerationStatus.COMPLETED,
        )
        db.add(blog)
        await db.commit()

    assert await _titles(client, "2026-06-02") == ["컬럼없는옛날글"]
    assert await _titles(client, "2026-06-05") == []
