import httpx

from app.config import settings


async def request_blog_generation(daily_record_data: dict, style: str) -> dict:
    """AI 서버에 블로그 생성 요청.

    AI 서버 URL이 설정되어 있으면 실제 호출,
    없으면 Mock 응답 반환.
    """
    if not settings.AI_SERVER_URL:
        return _mock_response(daily_record_data, style)

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{settings.AI_SERVER_URL}/generate",
            json={
                "daily_record": daily_record_data,
                "style": style,
            },
        )
        response.raise_for_status()
        return response.json()


def _mock_response(daily_record_data: dict, style: str) -> dict:
    """AI 서버가 준비되기 전까지 사용할 Mock 응답"""
    return {
        "title": f"[Mock] {style} 스타일 블로그",
        "content": (
            "이것은 AI 서버 연동 전 테스트용 Mock 블로그입니다.\n\n"
            "실제 AI 서버가 연결되면 이 내용이 대체됩니다.\n\n"
            f"요청된 스타일: {style}"
        ),
    }
