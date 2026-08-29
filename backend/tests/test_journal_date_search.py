"""저널 검색에서 날짜 표기로도 걸리는지 — 화면 포맷(YY.MM.DD(dy))과 동일해야 한다."""

from datetime import date

from app.models.blog import Blog
from app.models.enums import GenerationStatus
from tests.conftest import TEST_USER_ID, TestingSessionLocal


async def _make_blog(db, title, target_date):
    blog = Blog(
        user_id=TEST_USER_ID,
        title=title,
        content="본문",
        style="casual",
        target_date=target_date,
        generation_status=GenerationStatus.COMPLETED,
    )
    db.add(blog)
    await db.commit()
    return blog


async def _titles(client, q):
    res = await client.get(f"/api/v1/blogs?q={q}")
    assert res.status_code == 200
    return [b["title"] for b in res.json()["blogs"]]


async def test_search_by_full_date(client):
    """'26.08.06' 처럼 화면에 보이는 날짜로 검색"""
    async with TestingSessionLocal() as db:
        await _make_blog(db, "수요일글", date(2026, 8, 6))
        await _make_blog(db, "다른날글", date(2026, 7, 1))

    assert await _titles(client, "26.08.06") == ["수요일글"]


async def test_search_by_partial_date(client):
    """'26.08' 처럼 일부만 입력해도 그 달 글이 걸린다"""
    async with TestingSessionLocal() as db:
        await _make_blog(db, "팔월글", date(2026, 8, 6))
        await _make_blog(db, "칠월글", date(2026, 7, 1))

    assert await _titles(client, "26.08") == ["팔월글"]


async def test_search_by_weekday(client):
    """요일(wed)로도 검색된다 — 프론트 표기와 같은 소문자 3글자"""
    async with TestingSessionLocal() as db:
        await _make_blog(db, "수요일글", date(2026, 8, 5))  # wed
        await _make_blog(db, "금요일글", date(2026, 8, 7))  # fri

    assert await _titles(client, "wed") == ["수요일글"]


async def test_title_search_still_works(client):
    """기존 제목·본문 검색이 깨지지 않는다"""
    async with TestingSessionLocal() as db:
        await _make_blog(db, "성수동 카페", date(2026, 8, 6))
        await _make_blog(db, "강릉 바다", date(2026, 8, 7))

    assert await _titles(client, "성수동") == ["성수동 카페"]
