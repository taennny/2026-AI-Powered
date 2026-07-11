from fastapi import FastAPI

from app.api.v1.auth import router as auth_router
from app.api.v1.blog import router as blog_router
from app.api.v1.gps import router as gps_router
from app.api.v1.photos import router as photos_router
from app.api.v1.subscription import router as subscription_router
from app.api.v1.calendar import router as calendar_router

# 스키마는 Alembic 마이그레이션이 단독 관리한다.
# (기존 startup create_all은 alembic과 충돌해 제거 — 테이블 생성/변경은 alembic upgrade head로만)

app = FastAPI(
    title="Roame API",
    description="걷기만 해도 내 하루가 기록된다. 여행이 되는 날엔, 블로그가 된다.",
    version="0.1.0",
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
