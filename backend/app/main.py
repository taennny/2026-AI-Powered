from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.v1.auth import router as auth_router
from app.api.v1.blog import router as blog_router
from app.api.v1.subscription import router as subscription_router
from app.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """서버 시작할 때 DB 테이블 자동 생성"""
    await init_db()
    yield


app = FastAPI(
    title="Roame API",
    description="걷기만 해도 내 하루가 기록된다. 여행이 되는 날엔, 블로그가 된다.",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(auth_router)
app.include_router(blog_router)
app.include_router(subscription_router)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "roame-backend"}
