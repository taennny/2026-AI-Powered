"""블로그 입력 검증·상태 가드 테스트 (422/409/404/400)"""

import uuid
from unittest.mock import AsyncMock, patch

# ============================================================
# 1. 입력 길이·visibility 검증 (422)
# ============================================================


async def test_update_title_too_long(client, daily_record_id):
    """PUT title 300자 → 422"""
    res = await client.post(
        "/api/v1/blog/generate",
        json={"daily_record_id": str(daily_record_id), "style": "casual"},
    )
    blog_id = res.json()["blog_id"]

    res = await client.put(f"/api/v1/blog/{blog_id}", json={"title": "a" * 300})
    assert res.status_code == 422


async def test_update_invalid_visibility(client, daily_record_id):
    """PUT visibility "banana" → 422"""
    res = await client.post(
        "/api/v1/blog/generate",
        json={"daily_record_id": str(daily_record_id), "style": "casual"},
    )
    blog_id = res.json()["blog_id"]

    res = await client.put(f"/api/v1/blog/{blog_id}", json={"visibility": "banana"})
    assert res.status_code == 422


async def test_generate_style_too_long(client, daily_record_id):
    """generate style 100자 → 422"""
    res = await client.post(
        "/api/v1/blog/generate",
        json={"daily_record_id": str(daily_record_id), "style": "a" * 100},
    )
    assert res.status_code == 422


# ============================================================
# 2. 생성 진행 중 충돌 (409)
# ============================================================


async def test_update_while_generating_conflict(client, daily_record_id):
    """pending/generating 상태 블로그에 PUT → 409"""
    with patch("app.api.v1.blog.run_blog_generation", new_callable=AsyncMock):
        res = await client.post(
            "/api/v1/blog/generate",
            json={"daily_record_id": str(daily_record_id), "style": "casual"},
        )
        blog_id = res.json()["blog_id"]

    res = await client.put(f"/api/v1/blog/{blog_id}", json={"title": "새 제목"})
    assert res.status_code == 409


async def test_generate_duplicate_while_pending_conflict(client, daily_record_id):
    """첫 건이 pending인 상태에서 같은 daily_record로 generate 재요청 → 409"""
    with patch("app.api.v1.blog.run_blog_generation", new_callable=AsyncMock):
        res = await client.post(
            "/api/v1/blog/generate",
            json={"daily_record_id": str(daily_record_id), "style": "casual"},
        )
        assert res.status_code == 202

        res = await client.post(
            "/api/v1/blog/generate",
            json={"daily_record_id": str(daily_record_id), "style": "casual"},
        )
        assert res.status_code == 409


# ============================================================
# 3. publish 404/400 구분
# ============================================================


async def test_publish_nonexistent_blog(client):
    """존재하지 않는 blog_id publish → 404"""
    fake_id = str(uuid.uuid4())
    res = await client.post(f"/api/v1/blog/{fake_id}/publish")
    assert res.status_code == 404


async def test_publish_not_completed_blog(client, daily_record_id):
    """completed 아닌 블로그 publish → 400"""
    with patch("app.api.v1.blog.run_blog_generation", new_callable=AsyncMock):
        res = await client.post(
            "/api/v1/blog/generate",
            json={"daily_record_id": str(daily_record_id), "style": "casual"},
        )
        blog_id = res.json()["blog_id"]

    res = await client.post(f"/api/v1/blog/{blog_id}/publish")
    assert res.status_code == 400
