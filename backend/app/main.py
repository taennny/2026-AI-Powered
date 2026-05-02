from fastapi import FastAPI
from app.api.v1 import photos

app = FastAPI(
    title="Roame API",
    description="걷기만 해도 내 하루가 기록된다. 여행이 되는 날엔, 블로그가 된다.",
    version="0.1.0",
)

app.include_router(photos.router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "roame-backend"}
