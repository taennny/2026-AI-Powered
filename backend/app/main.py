from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from app.api.v1.auth import router as auth_router
from app.api.v1.blog import router as blog_router
from app.api.v1.calendar import router as calendar_router
from app.api.v1.gps import router as gps_router
from app.api.v1.photo import router as photo_router
from app.api.v1.subscription import router as subscription_router
from app.database import init_db
from app.schemas.blog import TimelineData
from app.services import blog_generator


@asynccontextmanager
async def lifespan(app: FastAPI):
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
app.include_router(gps_router)
app.include_router(subscription_router)
app.include_router(calendar_router, prefix="/api/v1")
app.include_router(photo_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "roame-backend"}


# ── 외부 AI 서버 연동용 엔드포인트 ────────────────────────────────────────────────


class GenerateRequest(BaseModel):
    style: Literal["info", "emotional", "casual"] = "info"
    timeline_data: TimelineData


class GenerateResponse(BaseModel):
    title: str
    content: str


@app.post("/generate", response_model=GenerateResponse)
async def generate_blog(req: GenerateRequest) -> GenerateResponse:
    try:
        result = await blog_generator.generate(req.style, req.timeline_data)
        return GenerateResponse(**result)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
