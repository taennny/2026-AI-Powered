import uuid
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import (
    AliasChoices,
    BaseModel,
    Field,
    computed_field,
    model_validator,
)

from app.config import settings


# --- 블로그 생성 요청/응답 ---
class BlogGenerateRequest(BaseModel):
    # 하루 모드는 daily_record_id, 기간 모드(모아쓰기)는 start_date+end_date.
    # 둘은 배타적이며 model_validator에서 검증한다.
    daily_record_id: Optional[uuid.UUID] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
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

    @model_validator(mode="after")
    def _check_target(self) -> "BlogGenerateRequest":
        """하루 모드와 기간 모드 중 정확히 하나만 지정됐는지 + 기간이 유효한지 검증."""
        has_single = self.daily_record_id is not None
        has_period = self.start_date is not None and self.end_date is not None
        # 한쪽만 온 start_date/end_date도 "지정한 것"으로 보고 섞임을 잡는다.
        # (daily_record_id + start_date만 보낸 요청을 통과시키면 안 된다)
        touched_period = self.start_date is not None or self.end_date is not None
        if has_single == has_period or (has_single and touched_period):
            raise ValueError(
                "daily_record_id 또는 start_date/end_date 중 하나만 지정하세요"
            )

        if has_period:
            if self.end_date < self.start_date:
                raise ValueError("end_date는 start_date보다 빠를 수 없습니다")
            days = (self.end_date - self.start_date).days + 1  # 양끝 포함
            if days > settings.MAX_BLOG_PERIOD_DAYS:
                raise ValueError(
                    f"기간은 최대 {settings.MAX_BLOG_PERIOD_DAYS}일까지 지정할 수 있습니다"
                )

        return self


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
    # 모아쓰기 종료일 (하루짜리는 None). 프론트가 "8/5~8/8" 표기에 쓴다
    period_end: Optional[date] = None
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
    # 모아쓰기 종료일 (하루짜리는 None). 프론트가 "8/5~8/8" 표기에 쓴다
    period_end: Optional[date] = None
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
