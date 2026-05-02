import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


# --- 블로그 생성 요청/응답 ---
class BlogGenerateRequest(BaseModel):
    daily_record_id: uuid.UUID
    style: str = Field(
        default="casual", description="블로그 스타일 (casual, formal, travel)"
    )


class BlogGenerateResponse(BaseModel):
    blog_id: uuid.UUID
    status: str
    message: str


# --- 블로그 상태 조회 ---
class BlogStatusResponse(BaseModel):
    blog_id: uuid.UUID
    status: str
    created_at: datetime


# --- 블로그 조회 ---
class BlogResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    daily_record_id: Optional[uuid.UUID] = None
    title: str
    content: str
    style: str
    target_date: date
    generation_status: str
    is_published: bool
    visibility: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- 블로그 목록 조회 ---
class BlogListResponse(BaseModel):
    blogs: list[BlogResponse]
    total: int


# --- 블로그 수정 ---
class BlogUpdateRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    visibility: Optional[str] = None


# --- 블로그 발행 ---
class BlogPublishResponse(BaseModel):
    blog_id: uuid.UUID
    is_published: bool
    message: str
