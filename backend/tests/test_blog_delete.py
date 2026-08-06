"""블로그 소프트 삭제 테스트 (204/404, 조회 제외, 생성 횟수 유지)"""

import uuid
from datetime import date
from unittest.mock import AsyncMock, patch

from app.config import settings
from app.models.blog import Blog
from app.models.enums import GenerationStatus
from tests.conftest import TestingSessionLocal


async def _generate(client, daily_record_id):
    return await client.post(
        "/api/v1/blog/generate",
        json={"daily_record_id": str(daily_record_id), "style": "casual"},
    )


async def _create_completed_blog(client, daily_record_id) -> str:
    """생성 요청 후 백그라운드 작업 없이 completed로 만들어 blog_id 반환"""
    with patch("app.api.v1.blog.run_blog_generation", new_callable=AsyncMock):
        res = await _generate(client, daily_record_id)
        assert res.status_code == 202
        blog_id = res.json()["blog_id"]

    async with TestingSessionLocal() as db:
        blog = await db.get(Blog, uuid.UUID(blog_id))
        blog.generation_status = GenerationStatus.COMPLETED.value
        await db.commit()

    return blog_id


# ============================================================
# 1. 삭제 후 조회에서 제외
# ============================================================


async def test_delete_then_detail_returns_404(client, daily_record_id):
    """삭제한 글 상세 조회 → 404"""
    blog_id = await _create_completed_blog(client, daily_record_id)

    assert (await client.delete(f"/api/v1/blog/{blog_id}")).status_code == 204
    assert (await client.get(f"/api/v1/blog/{blog_id}")).status_code == 404


async def test_delete_removes_from_list_and_total(client, daily_record_id):
    """삭제한 글은 목록에서 빠지고 total도 줄어든다"""
    blog_id = await _create_completed_blog(client, daily_record_id)
    await _create_completed_blog(client, daily_record_id)

    before = (await client.get("/api/v1/blogs")).json()
    assert before["total"] == 2

    assert (await client.delete(f"/api/v1/blog/{blog_id}")).status_code == 204

    after = (await client.get("/api/v1/blogs")).json()
    assert after["total"] == 1
    assert blog_id not in [b["id"] for b in after["blogs"]]


# ============================================================
# 2. 생성 횟수는 유지 (핵심 정책)
# ============================================================


async def test_delete_does_not_restore_quota(client, daily_record_id):
    """무료 한도까지 채운 뒤 1건 삭제해도 재생성은 여전히 429"""
    blog_ids = [
        await _create_completed_blog(client, daily_record_id)
        for _ in range(settings.FREE_WEEKLY_BLOG_LIMIT)
    ]

    assert (await client.delete(f"/api/v1/blog/{blog_ids[0]}")).status_code == 204

    res = await _generate(client, daily_record_id)
    assert res.status_code == 429
    assert res.json()["detail"]["used"] == settings.FREE_WEEKLY_BLOG_LIMIT


# ============================================================
# 3. 소유권 · 존재하지 않는 대상
# ============================================================


async def test_delete_other_users_blog_returns_404(client, daily_record_id):
    """남의 글 삭제 시도 → 404 (소유권 검증)"""
    other_blog_id = uuid.uuid4()
    async with TestingSessionLocal() as db:
        db.add(
            Blog(
                id=other_blog_id,
                user_id=uuid.uuid4(),  # 테스트 유저가 아닌 다른 유저
                daily_record_id=None,
                title="남의 글",
                content="내용",
                style="casual",
                target_date=date(2026, 5, 1),
                generation_status=GenerationStatus.COMPLETED.value,
            )
        )
        await db.commit()

    assert (await client.delete(f"/api/v1/blog/{other_blog_id}")).status_code == 404

    # 실제로 지워지지 않았는지 확인
    async with TestingSessionLocal() as db:
        blog = await db.get(Blog, other_blog_id)
        assert blog is not None
        assert blog.deleted_at is None


async def test_delete_nonexistent_blog_returns_404(client):
    """존재하지 않는 blog_id 삭제 → 404"""
    res = await client.delete(f"/api/v1/blog/{uuid.uuid4()}")
    assert res.status_code == 404


async def test_delete_twice_returns_404(client, daily_record_id):
    """이미 삭제한 글 재삭제 → 404"""
    blog_id = await _create_completed_blog(client, daily_record_id)

    assert (await client.delete(f"/api/v1/blog/{blog_id}")).status_code == 204
    assert (await client.delete(f"/api/v1/blog/{blog_id}")).status_code == 404


# ============================================================
# 4. 생성 중(pending)인 글도 삭제 가능
# ============================================================


async def test_delete_pending_blog(client, daily_record_id):
    """pending 상태 글도 삭제되고 상세·목록에서 사라진다"""
    with patch("app.api.v1.blog.run_blog_generation", new_callable=AsyncMock):
        res = await _generate(client, daily_record_id)
        blog_id = res.json()["blog_id"]

    assert (await client.delete(f"/api/v1/blog/{blog_id}")).status_code == 204
    assert (await client.get(f"/api/v1/blog/{blog_id}")).status_code == 404
    assert (await client.get("/api/v1/blogs")).json()["total"] == 0
