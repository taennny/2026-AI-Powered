import uuid
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import AliasChoices, BaseModel, Field, computed_field


# --- 블로그 생성 요청/응답 ---
class BlogGenerateRequest(BaseModel):
    daily_record_id: uuid.UUID
    # 프론트는 writing_style/writingStyle, 내부/구버전은 style — 모두 수용
    # 255/20은 DB 컬럼 한계(기술적 제한) — 정책 결정 시 조정
    style: str = Field(
        default="casual",
        max_length=20,
        validation_alias=AliasChoices("style", "writingStyle", "writing_style"),
        description="블로그 스타일",
    )
    # 사용자가 직접 쓴 하루 메모 (선택). 프론트 prompt 필드명도 수용
    user_note: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("user_note", "prompt"),
        description="사용자 작성 메모 (선택, 없으면 타임라인만으로 생성)",
    )

    model_config = {"populate_by_name": True, "extra": "ignore"}


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

    # 프론트가 상세/수정 응답에서 blog_id로 읽음 (생성/상태/발행 응답과 일관)
    @computed_field
    @property
    def blog_id(self) -> uuid.UUID:
        return self.id


# --- 블로그 목록 조회 ---
class BlogListItem(BaseModel):
    id: uuid.UUID
    date: date
    title: str
    summary: Optional[str] = None
    thumbnail_url: Optional[str] = None
    is_published: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class BlogListResponse(BaseModel):
    total: int
    page: int
    size: int
    blogs: list[BlogListItem]


# --- 블로그 수정 ---
class BlogUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, max_length=255)
    content: Optional[str] = None
    visibility: Optional[Literal["private", "public"]] = None


# --- 블로그 발행 ---
class BlogPublishResponse(BaseModel):
    blog_id: uuid.UUID
    is_published: bool
    message: str
