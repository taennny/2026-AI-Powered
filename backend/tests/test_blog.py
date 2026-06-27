"""블로그 생성 전체 흐름 E2E 테스트.

하루 기록 존재 → 생성 요청 → 백그라운드 처리 → 상태 변경 → 초안 조회 → 수정 → 발행
"""

import uuid

# ============================================================
# 1. 블로그 생성 E2E (핵심 흐름)
# ============================================================


async def test_blog_generate_e2e(client, daily_record_id):
    """생성 요청 → BackgroundTask 완료 → status=completed → 내용 조회"""

    # 1) POST /generate
    res = await client.post(
        "/api/v1/blog/generate",
        json={"daily_record_id": str(daily_record_id), "style": "casual"},
    )
    assert res.status_code == 202
    data = res.json()
    blog_id = data["blog_id"]
    assert data["status"] == "pending"

    # 2) GET /status — BackgroundTask가 ASGITransport에서 동기적으로 완료됨
    res = await client.get(f"/api/v1/blogs/{blog_id}/status")
    assert res.status_code == 200
    assert res.json()["status"] == "completed"

    # 3) GET /blog — 내용 확인
    res = await client.get(f"/api/v1/blog/{blog_id}")
    assert res.status_code == 200
    blog = res.json()
    assert blog["title"] != "생성 중..."
    assert blog["content"] != ""
    assert blog["style"] == "casual"
    assert blog["generation_status"] == "completed"
    # 프론트가 상세 응답에서 blog_id로 읽음 (id와 동일해야)
    assert blog["blog_id"] == blog["id"] == blog_id
    # is_published 기본값은 PostgreSQL에서 false, SQLite에서는 server_default 차이로 생략


# ============================================================
# 2. 블로그 수정
# ============================================================


async def test_blog_update(client, daily_record_id):
    """생성 후 title/content 수정"""
    # 생성
    res = await client.post(
        "/api/v1/blog/generate",
        json={"daily_record_id": str(daily_record_id), "style": "casual"},
    )
    blog_id = res.json()["blog_id"]

    # 수정
    res = await client.put(
        f"/api/v1/blog/{blog_id}",
        json={"title": "수정된 제목", "content": "수정된 내용"},
    )
    assert res.status_code == 200
    assert res.json()["title"] == "수정된 제목"
    assert res.json()["content"] == "수정된 내용"


# ============================================================
# 3. 블로그 발행
# ============================================================


async def test_blog_publish(client, daily_record_id):
    """completed 상태에서 발행 → is_published=True"""
    res = await client.post(
        "/api/v1/blog/generate",
        json={"daily_record_id": str(daily_record_id), "style": "casual"},
    )
    blog_id = res.json()["blog_id"]

    res = await client.post(f"/api/v1/blog/{blog_id}/publish")
    assert res.status_code == 200
    assert res.json()["is_published"] is True


async def test_blog_publish_before_completed_fails(client, daily_record_id):
    """pending/generating 상태에서 발행 시도 → 400"""
    # 직접 DB에 pending 상태 블로그를 만들기 위해 BackgroundTask 패치
    from unittest.mock import AsyncMock, patch

    with patch("app.api.v1.blog.run_blog_generation", new_callable=AsyncMock):
        res = await client.post(
            "/api/v1/blog/generate",
            json={"daily_record_id": str(daily_record_id), "style": "casual"},
        )
        blog_id = res.json()["blog_id"]

    res = await client.post(f"/api/v1/blog/{blog_id}/publish")
    assert res.status_code == 400


# ============================================================
# 4. 블로그 목록 조회
# ============================================================


async def test_blog_list(client, daily_record_id):
    """블로그 생성 후 목록에 포함되는지 확인"""
    # 빈 목록
    res = await client.get("/api/v1/blogs")
    assert res.status_code == 200
    assert res.json()["total"] == 0

    # 생성
    await client.post(
        "/api/v1/blog/generate",
        json={"daily_record_id": str(daily_record_id), "style": "casual"},
    )

    # 목록 재확인
    res = await client.get("/api/v1/blogs")
    assert res.status_code == 200
    assert res.json()["total"] == 1
    assert len(res.json()["blogs"]) == 1


async def test_blog_list_pagination_and_fields(client, daily_record_id):
    """목록 응답이 page/size + 카드 필드(date/summary)를 포함하는지 확인"""
    await client.post(
        "/api/v1/blog/generate",
        json={"daily_record_id": str(daily_record_id), "style": "casual"},
    )

    res = await client.get("/api/v1/blogs", params={"page": 1, "size": 5})
    assert res.status_code == 200
    body = res.json()
    assert body["page"] == 1
    assert body["size"] == 5

    item = body["blogs"][0]
    assert "date" in item
    assert "summary" in item
    assert "thumbnail_url" in item


async def test_blog_list_search(client, daily_record_id):
    """키워드 검색 — 매칭 없는 키워드는 빈 목록"""
    await client.post(
        "/api/v1/blog/generate",
        json={"daily_record_id": str(daily_record_id), "style": "casual"},
    )

    res = await client.get("/api/v1/blogs", params={"q": "존재하지않는키워드ZZZ"})
    assert res.status_code == 200
    assert res.json()["total"] == 0


# ============================================================
# 5. 에러 케이스
# ============================================================


async def test_generate_invalid_daily_record(client):
    """존재하지 않는 하루기록 ID → 404"""
    fake_id = str(uuid.uuid4())
    res = await client.post(
        "/api/v1/blog/generate",
        json={"daily_record_id": fake_id, "style": "casual"},
    )
    assert res.status_code == 404


async def test_get_nonexistent_blog(client):
    """존재하지 않는 블로그 조회 → 404"""
    fake_id = str(uuid.uuid4())
    res = await client.get(f"/api/v1/blog/{fake_id}")
    assert res.status_code == 404


# ============================================================
# 6. user_note / 필드 별칭 / 스타일 매핑
# ============================================================


async def test_generate_forwards_user_note_and_aliases(client, daily_record_id):
    """프론트가 prompt/writingStyle로 보내도 user_note·style로 받아 AI까지 전달"""
    from unittest.mock import AsyncMock, patch

    fake = AsyncMock(return_value={"title": "t", "content": "c"})
    with patch("app.services.blog.request_blog_generation", fake):
        res = await client.post(
            "/api/v1/blog/generate",
            json={
                "daily_record_id": str(daily_record_id),
                "writing_style": "emotion",  # 프론트 실제 필드 → style 별칭 → emotional
                "user_note": "오랜만에 친구 만난 날",
            },
        )
    assert res.status_code == 202

    # BackgroundTask가 ASGITransport에서 실행되며 AI 호출됨
    fake.assert_awaited_once()
    assert fake.call_args.kwargs["user_note"] == "오랜만에 친구 만난 날"
    assert fake.call_args.kwargs["style"] == "emotional"
