from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://roame:roame1234@db:5432/roame"
    SQL_ECHO: bool = False  # SQL 로그 출력 여부 (프로덕션은 false)

    # MinIO
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin123"
    MINIO_BUCKET_NAME: str = "roame-photos"
    # presigned URL용 공개 주소 (예: https://api.roame.co.kr). 빈 값이면 내부 주소로 서명(로컬용)
    MINIO_PUBLIC_ENDPOINT: str = ""

    # AI Server
    AI_SERVER_URL: str = ""

    # JWT
    JWT_SECRET_KEY: str = "change-this-to-random-secret-key"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # RevenueCat
    # 대시보드 Webhooks의 Authorization 값과 동일하게. 빈 값이면 웹훅 엔드포인트가 503 반환
    REVENUECAT_WEBHOOK_SECRET: str = ""
    # 이벤트 environment 필터 기준 (불일치 이벤트는 저장만): PRODUCTION | SANDBOX
    REVENUECAT_ENVIRONMENT: str = "PRODUCTION"

    # 생성 쿼터
    FREE_WEEKLY_BLOG_LIMIT: int = 3  # 무료 사용자 주간 AI 생성 한도. 회의 확정값 3
    DAY_BOUNDARY_HOUR: int = 4  # 하루 경계(새벽 4시). 주 리셋도 이 시각 기준
    # 한 편으로 묶을 수 있는 최대 일수(모아쓰기). 회의 미확정이라 넉넉히 잡음
    MAX_BLOG_PERIOD_DAYS: int = 31

    # Kakao
    KAKAO_REST_API_KEY: str = ""
    KAKAO_REDIRECT_URI: str = ""
    KAKAO_CLIENT_SECRET: str = ""

    # Mail
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str = ""
    MAIL_SERVER: str = ""
    MAIL_PORT: int = 587

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
