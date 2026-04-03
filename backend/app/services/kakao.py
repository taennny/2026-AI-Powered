import httpx
from app.config import settings


async def get_kakao_token(code: str) -> dict:
    """인가 코드로 카카오 액세스 토큰 받기"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://kauth.kakao.com/oauth/token",
            data={
                "grant_type": "authorization_code",
                "client_id": settings.KAKAO_REST_API_KEY,
                "redirect_uri": settings.KAKAO_REDIRECT_URI,
                "code": code,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
    if response.status_code != 200:
        raise ValueError("유효하지 않은 인가 코드입니다")
    return response.json()


async def get_kakao_user_info(kakao_access_token: str) -> dict:
    """카카오 액세스 토큰으로 유저 정보 받기"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://kapi.kakao.com/v2/user/me",
            headers={"Authorization": f"Bearer {kakao_access_token}"}
        )
    if response.status_code != 200:
        raise ValueError("유저 정보를 가져올 수 없습니다")
    return response.json()