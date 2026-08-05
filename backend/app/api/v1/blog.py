import uuid
from datetime import date

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.blog import (
    BlogGenerateRequest,
    BlogGenerateResponse,
    BlogListItem,
    BlogListResponse,
    BlogPublishResponse,
    BlogResponse,
    BlogStatusResponse,
    BlogUpdateRequest,
)
from app.services.blog import (
    BlogConflictError,
    BlogStateError,
    create_blog_generation,
    get_blog_by_id,
    get_blog_list,
    publish_blog,
    run_blog_generation,
    update_blog,
)
from app.utils.dependencies import get_current_user

router = APIRouter(tags=["blog"])


@router.get("/api/v1/blogs", response_model=BlogListResponse)
async def list_blogs(
    q: str | None = Query(None, description="제목/본문 키워드 검색"),
    target_date: date | None = Query(None, alias="date", description="날짜 필터"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """블로그 목록 조회 (키워드 검색 / 날짜 필터 / 페이지네이션)"""
    blogs, total = await get_blog_list(db, current_user.id, page, size, q, target_date)
    items = [
        BlogListItem(
            id=b.id,
            date=b.target_date,
            title=b.title,
            summary=(b.content[:100] if b.content else None),
            thumbnail_url=None,
            is_published=b.is_published,
            created_at=b.created_at,
        )
        for b in blogs
    ]
    return BlogListResponse(total=total, page=page, size=size, blogs=items)


@router.post(
    "/api/v1/blog/generate", response_model=BlogGenerateResponse, status_code=202
)
async def generate_blog(
    request: BlogGenerateRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """AI 블로그 생성 요청 (비동기)"""
    try:
        blog = await create_blog_generation(
            db, current_user.id, request.daily_record_id, request.style
        )
    except BlogConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    background_tasks.add_task(run_blog_generation, blog.id, request.user_note)

    return BlogGenerateResponse(
        blog_id=blog.id,
        status=blog.generation_status,
        message="블로그 생성이 요청되었습니다",
    )


@router.get("/api/v1/blogs/{blog_id}/status", response_model=BlogStatusResponse)
async def blog_status(
    blog_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """블로그 생성 상태 조회"""
    try:
        blog = await get_blog_by_id(db, blog_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return BlogStatusResponse(
        blog_id=blog.id,
        status=blog.generation_status,
        created_at=blog.created_at,
    )


@router.get("/api/v1/blog/{blog_id}", response_model=BlogResponse)
async def get_blog(
    blog_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """블로그 조회"""
    try:
        blog = await get_blog_by_id(db, blog_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return blog


@router.put("/api/v1/blog/{blog_id}", response_model=BlogResponse)
async def edit_blog(
    blog_id: uuid.UUID,
    request: BlogUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """블로그 수정"""
    try:
        blog = await update_blog(
            db,
            blog_id,
            current_user.id,
            request.title,
            request.content,
            request.visibility,
        )
    except BlogConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return blog


@router.post("/api/v1/blog/{blog_id}/publish", response_model=BlogPublishResponse)
async def publish(
    blog_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """블로그 발행"""
    try:
        blog = await publish_blog(db, blog_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BlogStateError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return BlogPublishResponse(
        blog_id=blog.id,
        is_published=blog.is_published,
        message="블로그가 발행되었습니다",
    )
