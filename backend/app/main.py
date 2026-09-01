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
from app.api.v1.webhooks import router as webhooks_router
from app.config import settings
from app.services.storage import ensure_bucket_exists

logger = logging.getLogger(__name__)

# 스키마는 Alembic 마이그레이션이 단독 관리한다.
# (기존 startup create_all은 alembic과 충돌해 제거 — 테이블 생성/변경은 alembic upgrade head로만)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작 시 MinIO 버킷 확인/생성. MinIO가 안 떠 있어도 앱은 정상 기동해야 하므로 fail-soft."""
    if settings.BETA_ALL_PREMIUM:
        # 끄는 걸 잊은 채 정식 출시되면 아무도 결제하지 않아도 되므로 기동마다 남긴다
        logger.warning(
            "BETA_ALL_PREMIUM이 켜져 있습니다 — 모든 사용자가 결제 없이 프리미엄 기능을 사용합니다"
        )

    try:
        await ensure_bucket_exists()
    except Exception:
        logger.warning(
            "MinIO 버킷 확인/생성 실패 — 앱은 계속 기동합니다.", exc_info=True
        )
    yield


# CORS 허용 오리진 (allowlist)
# 네이티브 앱은 CORS 대상이 아니라 브라우저에서 오는 요청만 해당된다.
# 웹으로 배포하는 화면이 없다고 프론트에서 확인받아 전부 닫았다.
# 웹 화면이 생기면 그 배포 도메인만 여기에 추가한다.
ALLOWED_ORIGINS: list[str] = []

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
app.include_router(webhooks_router)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "roame-backend"}
