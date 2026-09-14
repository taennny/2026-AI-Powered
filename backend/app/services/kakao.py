import httpx

from app.config import settings


def get_kakao_authorize_url(state: str) -> str:
    """카카오 인가 URL 생성 (계정 연동 시작용)"""
    return (
        "https://kauth.kakao.com/oauth/authorize"
        f"?client_id={settings.KAKAO_REST_API_KEY}"
        f"&redirect_uri={settings.KAKAO_REDIRECT_URI}"
        "&response_type=code"
        f"&state={state}"
    )


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
                "client_secret": settings.KAKAO_CLIENT_SECRET,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    if response.status_code != 200:
        print(f"카카오 토큰 오류: {response.status_code} {response.text}")
        raise ValueError("유효하지 않은 인가 코드입니다")
    return response.json()


async def get_kakao_user_info(kakao_access_token: str) -> dict:
    """카카오 액세스 토큰으로 유저 정보 받기"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://kapi.kakao.com/v2/user/me",
            headers={"Authorization": f"Bearer {kakao_access_token}"},
        )
    if response.status_code != 200:
        raise ValueError("유저 정보를 가져올 수 없습니다")
    return response.json()


async def search_kakao_places(query: str) -> list[dict]:
    """카카오 로컬 키워드 검색 (주소/건물명/장소명 통합 검색)"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://dapi.kakao.com/v2/local/search/keyword.json",
            params={"query": query},
            headers={"Authorization": f"KakaoAK {settings.KAKAO_REST_API_KEY}"},
        )
    if response.status_code != 200:
        raise ValueError("주소 검색에 실패했습니다")

    data = response.json()
    return [
        {
            "place_name": doc["place_name"],
            "address": doc["road_address_name"] or doc["address_name"],
            "latitude": float(doc["y"]),
            "longitude": float(doc["x"]),
        }
        for doc in data.get("documents", [])
    ]


async def coord_to_address(latitude: float, longitude: float) -> dict:
    """좌표 → 주소 변환 (카카오 로컬 좌표-주소 변환)"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://dapi.kakao.com/v2/local/geo/coord2address.json",
            params={"x": longitude, "y": latitude},
            headers={"Authorization": f"KakaoAK {settings.KAKAO_REST_API_KEY}"},
        )
    if response.status_code != 200:
        raise ValueError("주소 변환에 실패했습니다")

    data = response.json()
    documents = data.get("documents", [])
    if not documents:
        raise ValueError("해당 좌표의 주소를 찾을 수 없습니다")

    address_info = documents[0]
    road_address = address_info.get("road_address")
    address = address_info.get("address")

    return {
        "address": (road_address or address).get("address_name"),
    }
