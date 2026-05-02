import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


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


class BlogGenerateRequest(BaseModel):
    user_id: uuid.UUID
    daily_record_id: uuid.UUID | None = None
    style: Literal["emotional", "info"]
    timeline_data: TimelineData


class BlogGenerateResponse(BaseModel):
    blog_id: uuid.UUID
    status: str


class ParsedSection(BaseModel):
    seq: int | None  # matches TimelineBlock.seq, None for intro/outro/table
    heading: str | None
    body: str
    info_box: str | None = None
    photo_tags: list[str] = Field(default_factory=list)  # ["[PHOTO:1:1]", ...]


class ParsedBlog(BaseModel):
    title: str
    sections: list[ParsedSection]
    total_expense_table: str | None = None
    raw_content: str


class BlogStatusResponse(BaseModel):
    blog_id: uuid.UUID
    generation_status: str
    title: str | None = None


class BlogResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    daily_record_id: uuid.UUID | None
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
