import uuid
from datetime import date, datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.blog import Blog
from app.schemas.blog import BlogGenerateRequest, BlogResponse, BlogStatusResponse
from app.services import blog_generator

router = APIRouter(prefix="/blog", tags=["blog"])
blogs_router = APIRouter(prefix="/blogs", tags=["blog"])


class BlogListResponse(BaseModel):
    items: list[BlogResponse]
    total: int


@blogs_router.get("", response_model=BlogListResponse, summary="블로그 목록 + 검색")
async def list_blogs(
    user_id: uuid.UUID = Query(...),
    style: Literal["emotional", "info"] | None = Query(None),
    q: str | None = Query(None, description="제목 검색어"),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    published_only: bool = Query(False),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> BlogListResponse:
    stmt = select(Blog).where(Blog.user_id == user_id)

    if style:
        stmt = stmt.where(Blog.style == style)
    if q:
        stmt = stmt.where(Blog.title.ilike(f"%{q}%"))
    if date_from:
        stmt = stmt.where(Blog.target_date >= date_from)
    if date_to:
        stmt = stmt.where(Blog.target_date <= date_to)
    if published_only:
        stmt = stmt.where(Blog.is_published.is_(True))

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = stmt.order_by(Blog.target_date.desc()).limit(limit).offset(offset)
    result = await db.execute(stmt)
    blogs = result.scalars().all()

    return BlogListResponse(
        items=[BlogResponse.model_validate(b) for b in blogs],
        total=total,
    )


@router.post("/generate")
async def generate_blog(
    req: BlogGenerateRequest,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    return StreamingResponse(
        blog_generator.generate_stream(req, db),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/{blog_id}/status", response_model=BlogStatusResponse)
async def get_blog_status(
    blog_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> BlogStatusResponse:
    blog = await db.get(Blog, blog_id)
    if not blog:
        raise HTTPException(status_code=404, detail="Blog not found")
    return BlogStatusResponse(
        blog_id=blog.id,
        generation_status=blog.generation_status,
        title=blog.title or None,
    )


@router.get("/{blog_id}", response_model=BlogResponse)
async def get_blog(
    blog_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> BlogResponse:
    blog = await db.get(Blog, blog_id)
    if not blog:
        raise HTTPException(status_code=404, detail="Blog not found")
    return BlogResponse.model_validate(blog)


class BlogUpdateRequest(BaseModel):
    title: str | None = None
    content: str | None = None
    visibility: Literal["private", "public"] | None = None


@router.put("/{blog_id}", response_model=BlogResponse)
async def update_blog(
    blog_id: uuid.UUID,
    req: BlogUpdateRequest,
    db: AsyncSession = Depends(get_db),
) -> BlogResponse:
    blog = await db.get(Blog, blog_id)
    if not blog:
        raise HTTPException(status_code=404, detail="Blog not found")
    if blog.generation_status not in ("completed", "failed"):
        raise HTTPException(status_code=409, detail="Cannot edit while generation is in progress")

    if req.title is not None:
        blog.title = req.title
    if req.content is not None:
        blog.content = req.content
    if req.visibility is not None:
        blog.visibility = req.visibility

    blog.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(blog)
    return BlogResponse.model_validate(blog)


@router.post("/{blog_id}/publish", response_model=BlogResponse)
async def publish_blog(
    blog_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> BlogResponse:
    blog = await db.get(Blog, blog_id)
    if not blog:
        raise HTTPException(status_code=404, detail="Blog not found")
    if blog.generation_status != "completed":
        raise HTTPException(status_code=409, detail="Only completed blogs can be published")
    if blog.is_published:
        raise HTTPException(status_code=409, detail="Already published")

    blog.is_published = True
    blog.visibility = "public"
    blog.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(blog)
    return BlogResponse.model_validate(blog)
