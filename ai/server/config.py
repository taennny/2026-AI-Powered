"""통합 AI 추론 서버 환경설정.

.env 로드는 app.py 진입점에서 수행하며, 이 모듈은 os.environ 값을 읽기만 한다.
"""

import os


class Settings:
    # 카카오 로컬 API (AI-1 국내 장소 매칭)
    KAKAO_API_KEY: str = os.getenv("KAKAO_API_KEY", "")

    # 구글 Places API (AI-1 해외 장소 매칭 — 국내는 카카오, 국외는 구글 하이브리드)
    # 미설정 시 해외 좌표는 매칭 없이 "알 수 없음"으로 처리(기존 동작 유지).
    GOOGLE_MAPS_API_KEY: str = os.getenv("GOOGLE_MAPS_API_KEY", "")

    # OpenAI (AI-3 블로그 생성)
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o")

    # 서버 포트 (백엔드 AI_SERVER_URL 과 일치시킬 단일 진입점)
    PORT: int = int(os.getenv("PORT", "5000"))


settings = Settings()
