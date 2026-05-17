import asyncio
import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
RETRY_DELAYS = [1, 3, 5]  # 초 단위 대기 (1s → 3s → 5s)
TIMEOUT_SECONDS = 60.0  # GPT-4o 블로그 생성 고려


async def request_blog_generation(daily_record_data: dict, style: str) -> dict:
    """AI 서버에 블로그 생성 요청.

    AI 서버 URL이 설정되어 있으면 실제 호출 (최대 3회 재시도),
    없으면 Mock 응답 반환.
    """
    if not settings.AI_SERVER_URL:
        return _mock_response(daily_record_data, style)

    last_exception = None

    for attempt in range(MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
                response = await client.post(
                    f"{settings.AI_SERVER_URL}/generate",
                    json={
                        "daily_record": daily_record_data,
                        "style": style,
                    },
                )
                response.raise_for_status()
                return response.json()

        except httpx.TimeoutException as e:
            last_exception = e
            logger.warning(
                "AI 서버 타임아웃 (시도 %d/%d): %s",
                attempt + 1,
                MAX_RETRIES,
                e,
            )

        except httpx.HTTPStatusError as e:
            # 4xx 클라이언트 에러는 재시도 의미 없음
            if 400 <= e.response.status_code < 500:
                raise
            last_exception = e
            logger.warning(
                "AI 서버 오류 %d (시도 %d/%d)",
                e.response.status_code,
                attempt + 1,
                MAX_RETRIES,
            )

        except httpx.ConnectError as e:
            last_exception = e
            logger.warning(
                "AI 서버 연결 실패 (시도 %d/%d): %s",
                attempt + 1,
                MAX_RETRIES,
                e,
            )

        # 마지막 시도가 아니면 대기 후 재시도
        if attempt < MAX_RETRIES - 1:
            delay = RETRY_DELAYS[attempt]
            logger.info("AI 서버 재시도 %d초 후...", delay)
            await asyncio.sleep(delay)

    raise last_exception  # type: ignore[misc]


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
