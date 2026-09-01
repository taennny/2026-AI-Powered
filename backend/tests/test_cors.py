"""CORS 정책 — 웹으로 배포하는 화면이 없어 브라우저 오리진을 전부 닫았다.

네이티브 앱은 CORS 대상이 아니라 이 설정에 영향받지 않는다.
웹 화면이 생기면 ALLOWED_ORIGINS에 그 도메인만 추가한다.
"""

from app.main import ALLOWED_ORIGINS


async def test_no_origin_is_allowed(client):
    """개발용 오리진도 더는 허용되지 않는다"""
    res = await client.get("/health", headers={"Origin": "http://localhost:8081"})
    assert "access-control-allow-origin" not in res.headers


async def test_cors_blocks_unknown_origin(client):
    """허용 목록에 없는 오리진에는 허용 헤더를 주지 않는다"""
    res = await client.get("/health", headers={"Origin": "https://evil.example.com"})
    assert "access-control-allow-origin" not in res.headers


def test_allowlist_is_empty():
    """실수로 로컬 오리진이 다시 들어오는 것을 막는다"""
    assert ALLOWED_ORIGINS == []
