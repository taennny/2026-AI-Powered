"""개인화 문체(style_examples) 전달 테스트 — 유료 전용, 최근 발행 글 수집."""

import uuid
from datetime import date, datetime, timedelta, timezone

from app.models.blog import Blog
from app.models.enums import GenerationStatus
from app.services.blog import (
    STYLE_EXAMPLE_COUNT,
    STYLE_EXAMPLE_MAX_CHARS,
    _get_style_examples,
)
from app.services.subscription import update_user_subscription
from tests.conftest import TEST_USER_ID, TestingSessionLocal


_seq = 0


async def _make_blog(db, content, published=True):
    # created_at을 순차 시각으로 명시 — 연속 생성 시 동점으로 정렬이 흔들리는 것 방지
    global _seq
    _seq += 1
    blog = Blog(
        user_id=TEST_USER_ID,
        title="t",
        content=content,
        style="casual",
        target_date=date(2026, 8, 1),
        generation_status=GenerationStatus.COMPLETED,
        is_published=published,
        created_at=datetime(2026, 8, 1, tzinfo=timezone.utc) + timedelta(minutes=_seq),
    )
    db.add(blog)
    await db.commit()
    await db.refresh(blog)
    return blog


async def test_free_user_gets_no_examples():
    """무료 사용자는 발행 글이 있어도 빈 배열 (개인화 문체는 구독 혜택)"""
    async with TestingSessionLocal() as db:
        await _make_blog(db, "발행된 글")
        examples = await _get_style_examples(db, TEST_USER_ID, uuid.uuid4())
        assert examples == []


async def test_premium_gets_recent_published_only():
    """유료: 발행 글만 최신순, 미발행·빈 글 제외, 개수 상한"""
    async with TestingSessionLocal() as db:
        await update_user_subscription(db, TEST_USER_ID, "premium")
        await _make_blog(db, "옛 글")
        await _make_blog(db, "미발행 글", published=False)
        await _make_blog(db, "")
        await _make_blog(db, "최신 글")

        examples = await _get_style_examples(db, TEST_USER_ID, uuid.uuid4())
        assert examples[0] == "최신 글"
        assert "미발행 글" not in examples
        assert "" not in examples
        assert len(examples) <= STYLE_EXAMPLE_COUNT


async def test_premium_excludes_current_blog_and_truncates():
    """생성 중인 글 자신은 제외, 긴 글은 상한 길이로 절단"""
    async with TestingSessionLocal() as db:
        await update_user_subscription(db, TEST_USER_ID, "premium")
        long_blog = await _make_blog(db, "가" * 3000)
        current = await _make_blog(db, "지금 생성 중")

        examples = await _get_style_examples(db, TEST_USER_ID, current.id)
        assert "지금 생성 중" not in examples
        assert max(len(e) for e in examples) <= STYLE_EXAMPLE_MAX_CHARS
        assert examples[0][:10] == long_blog.content[:10]
