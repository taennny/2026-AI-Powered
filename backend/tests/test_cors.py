"""CORS 설정 테스트 — 브라우저(Expo 웹) 개발 오리진 허용 확인."""


async def test_cors_allows_expo_web_origin(client):
    """허용된 오리진의 프리플라이트 요청에 CORS 헤더가 실린다"""
    res = await client.options(
        "/api/v1/auth/register",
        headers={
            "Origin": "http://localhost:8081",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert res.status_code in (200, 204)
    assert res.headers["access-control-allow-origin"] == "http://localhost:8081"


async def test_cors_blocks_unknown_origin(client):
    """허용 목록에 없는 오리진에는 허용 헤더를 주지 않는다"""
    res = await client.get("/health", headers={"Origin": "https://evil.example.com"})
    assert "access-control-allow-origin" not in res.headers
