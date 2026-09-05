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
    # 기본값으로 기동되면 토큰 위조가 가능하므로 아래 검증에서 막는다
    JWT_SECRET_KEY: str = "change-this-to-random-secret-key"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # 베타 기간 전원 프리미엄. 켜면 결제 없이 모든 사용자가 프리미엄 기능을 쓴다.
    # DB는 건드리지 않고 읽는 쪽에서만 적용하므로, 끄면 즉시 원래 상태로 돌아온다.
    BETA_ALL_PREMIUM: bool = False

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


_INSECURE_JWT_DEFAULT = "change-this-to-random-secret-key"

settings = Settings()

# 기본값이나 빈 값으로 기동되면 누구나 토큰을 위조할 수 있다.
# 개발 편의보다 사고 예방이 우선이라 기동 자체를 막는다.
if (
    settings.JWT_SECRET_KEY == _INSECURE_JWT_DEFAULT
    or len(settings.JWT_SECRET_KEY) < 32
):
    raise RuntimeError(
        "JWT_SECRET_KEY가 비어 있거나 예시 기본값입니다. "
        ".env에 32자 이상 랜덤 값을 설정하세요 (생성 예: openssl rand -hex 32)"
    )
