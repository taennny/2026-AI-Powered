from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://roame:roame1234@db:5432/roame"

    # OpenAI
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    # MinIO
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin123"
    MINIO_BUCKET_NAME: str = "roame-photos"

    # JWT
    JWT_SECRET_KEY: str = "change-this-to-random-secret-key"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Kakao
    KAKAO_REST_API_KEY: str = ""
    KAKAO_REDIRECT_URI: str = ""

    # AI Server (외부 LLM 서버 URL)
    AI_SERVER_URL: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
