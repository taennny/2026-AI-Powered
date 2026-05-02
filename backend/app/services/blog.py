import uuid
import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.blog import Blog
from app.models.daily_record import DailyRecord
from app.models.enums import GenerationStatus
from app.services.ai_client import request_blog_generation

logger = logging.getLogger(__name__)


async def create_blog_generation(
    db: AsyncSession, user_id: uuid.UUID, daily_record_id: uuid.UUID, style: str
) -> Blog:
    """블로그 생성 요청 → pending 상태로 DB 저장"""
    result = await db.execute(
        select(DailyRecord).where(
            DailyRecord.id == daily_record_id,
            DailyRecord.user_id == user_id,
        )
    )
    daily_record = result.scalar_one_or_none()
    if not daily_record:
        raise ValueError("해당 하루 기록을 찾을 수 없습니다")

    blog = Blog(
        user_id=user_id,
        daily_record_id=daily_record_id,
        title="생성 중...",
        content="",
        style=style,
        target_date=daily_record.target_date,
        generation_status=GenerationStatus.PENDING,
    )
    db.add(blog)
    await db.commit()
    await db.refresh(blog)
    return blog


async def run_blog_generation(blog_id: uuid.UUID) -> None:
    """BackgroundTask에서 실행 — 독립 세션으로 AI 호출 후 블로그 업데이트"""
    async with async_session() as db:
        result = await db.execute(select(Blog).where(Blog.id == blog_id))
        blog = result.scalar_one_or_none()
        if not blog:
            return

        blog.generation_status = GenerationStatus.GENERATING
        await db.commit()

        try:
            ai_result = await request_blog_generation(
                daily_record_data={
                    "daily_record_id": str(blog.daily_record_id),
                    "target_date": str(blog.target_date),
                },
                style=blog.style,
            )

            blog.title = ai_result.get("title", "제목 없음")
            blog.content = ai_result.get("content", "")
            blog.generation_status = GenerationStatus.COMPLETED

        except Exception as e:
            logger.error("블로그 생성 실패: blog_id=%s, error=%s", blog_id, e)
            blog.generation_status = GenerationStatus.FAILED

        await db.commit()


async def get_blog_by_id(
    db: AsyncSession, blog_id: uuid.UUID, user_id: uuid.UUID
) -> Blog:
    """블로그 단건 조회"""
    result = await db.execute(
        select(Blog).where(Blog.id == blog_id, Blog.user_id == user_id)
    )
    blog = result.scalar_one_or_none()
    if not blog:
        raise ValueError("블로그를 찾을 수 없습니다")
    return blog


async def get_blog_list(
    db: AsyncSession, user_id: uuid.UUID, skip: int = 0, limit: int = 20
) -> tuple[list[Blog], int]:
    """블로그 목록 조회 + 총 개수"""
    count_result = await db.execute(
        select(func.count()).select_from(Blog).where(Blog.user_id == user_id)
    )
    total = count_result.scalar_one()

    result = await db.execute(
        select(Blog)
        .where(Blog.user_id == user_id)
        .order_by(Blog.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    blogs = list(result.scalars().all())
    return blogs, total


async def update_blog(
    db: AsyncSession,
    blog_id: uuid.UUID,
    user_id: uuid.UUID,
    title: str | None = None,
    content: str | None = None,
    visibility: str | None = None,
) -> Blog:
    """블로그 수정"""
    blog = await get_blog_by_id(db, blog_id, user_id)

    if title is not None:
        blog.title = title
    if content is not None:
        blog.content = content
    if visibility is not None:
        blog.visibility = visibility

    await db.commit()
    await db.refresh(blog)
    return blog


async def publish_blog(
    db: AsyncSession, blog_id: uuid.UUID, user_id: uuid.UUID
) -> Blog:
    """블로그 발행"""
    blog = await get_blog_by_id(db, blog_id, user_id)

    if blog.generation_status != GenerationStatus.COMPLETED:
        raise ValueError("생성이 완료된 블로그만 발행할 수 있습니다")

    blog.is_published = True
    blog.visibility = "public"
    await db.commit()
    await db.refresh(blog)
    return blog
