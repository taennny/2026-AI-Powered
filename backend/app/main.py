import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.auth import router as auth_router
from app.api.v1.blog import router as blog_router
from app.api.v1.gps import router as gps_router
from app.api.v1.photos import router as photos_router
from app.api.v1.subscription import router as subscription_router
from app.api.v1.calendar import router as calendar_router
from app.services.storage import ensure_bucket_exists

logger = logging.getLogger(__name__)

# 스키마는 Alembic 마이그레이션이 단독 관리한다.
# (기존 startup create_all은 alembic과 충돌해 제거 — 테이블 생성/변경은 alembic upgrade head로만)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작 시 MinIO 버킷 확인/생성. MinIO가 안 떠 있어도 앱은 정상 기동해야 하므로 fail-soft."""
    try:
        await ensure_bucket_exists()
    except Exception:
        logger.warning(
            "MinIO 버킷 확인/생성 실패 — 앱은 계속 기동합니다.", exc_info=True
        )
    yield


# CORS 허용 오리진 (allowlist)
# 네이티브 앱은 CORS 대상이 아니며, 아래는 브라우저(Expo 웹) 개발용이다.
# TODO(출시 전): 로컬 개발용 오리진 제거 + 프론트 배포 도메인으로 교체
ALLOWED_ORIGINS = [
    "http://localhost:8081",  # Expo 웹 기본 포트
    "http://localhost:19006",  # Expo 웹 (구버전 포트)
    "http://localhost:3000",  # 웹 개발 서버 예비
]

app = FastAPI(
    title="Roame API",
    description="걷기만 해도 내 하루가 기록된다. 여행이 되는 날엔, 블로그가 된다.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,  # 쿠키 미사용이나 확장 대비 (allowlist라 * 와 충돌 없음)
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(blog_router)
app.include_router(gps_router)
app.include_router(photos_router)
app.include_router(subscription_router)
app.include_router(calendar_router)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "roame-backend"}
