import uuid
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


# --- 블로그 생성 요청/응답 ---
class BlogGenerateRequest(BaseModel):
    daily_record_id: uuid.UUID
    style: str = Field(
        default="casual", description="블로그 스타일 (casual, emotional, info)"
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


# ── 외부 /generate 엔드포인트용 스키마 ──────────────────────────────────────────


class ExpenseSchema(BaseModel):
    amount: int
    item: str


class TimelineBlock(BaseModel):
    seq: int
    start: str
    end: str
    place: str
    category: str
    address: str
    expense: ExpenseSchema | None = None
    photos: int = 0
    memo: str | None = None


class UserProfile(BaseModel):
    nickname: str
    taste_tags: list[str] = Field(default_factory=list)


class TimelineData(BaseModel):
    date: str  # "YYYY-MM-DD"
    user: UserProfile
    blocks: list[TimelineBlock]


class ParsedSection(BaseModel):
    seq: int | None
    heading: str | None
    body: str
    info_box: str | None = None
    photo_tags: list[str] = Field(default_factory=list)


class ParsedBlog(BaseModel):
    title: str
    sections: list[ParsedSection]
    total_expense_table: str | None = None
    raw_content: str
