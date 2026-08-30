import uuid
import logging
from datetime import date, datetime, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import defer

from app.config import settings
from app.database import async_session
from app.models.blog import Blog
from app.models.daily_record import DailyRecord
from app.models.enums import GenerationStatus
from app.models.place import Place
from app.models.user import User
from app.services.ai_client import request_blog_generation
from app.services.subscription import get_user_subscription, is_premium
from app.services.timeline_serializer import (
    build_multi_day_timeline_data,
    build_timeline_data,
    map_style,
)
from app.utils.timezone import week_bounds

logger = logging.getLogger(__name__)


class BlogConflictError(Exception):
    """생성 진행 중 충돌 (409)"""


class BlogStateError(Exception):
    """상태 전이 오류 (400)"""


class QuotaExceededError(Exception):
    """주간 생성 한도 초과 (429)"""

    def __init__(self, limit: int, used: int, reset_at: datetime):
        super().__init__("이번 주 생성 횟수를 모두 사용했습니다")
        self.limit = limit
        self.used = used
        self.reset_at = reset_at


async def get_weekly_usage(
    db: AsyncSession, user_id: uuid.UUID
) -> tuple[int, datetime]:
    """이번 주 생성 사용 횟수와 다음 리셋 시각(UTC aware) 반환.

    실패(FAILED) 건은 세지 않으므로 "생성 실패 시 횟수 복구"가 별도 로직 없이 성립한다.
    취소 기능은 아직 없지만, 나중에 취소를 FAILED로 기록하면 같은 원리로 복구된다.

    다른 조회와 달리 여기만 `deleted_at IS NULL` 필터를 넣지 않는다.
    팀 정책이 "글을 받았으면 생성 1회 사용"이라 삭제해도 횟수는 유지돼야 하고,
    필터를 넣으면 "생성 → 삭제 → 재생성"으로 한도를 무한히 우회할 수 있다.
    """
    start, end = week_bounds()
    used = (
        await db.execute(
            select(func.count())
            .select_from(Blog)
            .where(
                Blog.user_id == user_id,
                Blog.created_at >= start,
                Blog.created_at < end,
                Blog.generation_status != GenerationStatus.FAILED,
            )
        )
    ).scalar_one()
    return used, end


async def _load_places(db: AsyncSession, daily_record_id: uuid.UUID) -> list[Place]:
    """하루 기록에 속한 장소를 방문 순서대로 조회."""
    return list(
        (
            await db.execute(
                select(Place)
                .where(Place.daily_record_id == daily_record_id)
                .order_by(Place.arrived_at)
                .options(defer(Place.location))  # 블로그 생성엔 좌표 불필요
            )
        )
        .scalars()
        .all()
    )


async def _build_multi_day_timeline(db: AsyncSession, blog: Blog, user: User) -> dict:
    """모아쓰기 블로그의 기간 내 기록들을 날짜순으로 모아 여러 날 payload 생성."""
    daily_records = list(
        (
            await db.execute(
                select(DailyRecord)
                .where(
                    DailyRecord.user_id == blog.user_id,
                    DailyRecord.target_date >= blog.target_date,
                    DailyRecord.target_date <= blog.period_end,
                )
                .order_by(DailyRecord.target_date)
            )
        )
        .scalars()
        .all()
    )
    # 기록이 없는 날은 그냥 빠진다 (여행 중 쉰 날까지 빈 블록으로 보낼 필요 없음)
    if not daily_records:
        raise ValueError("해당 기간에 기록이 없습니다")

    days_data = [
        (record, await _load_places(db, record.id)) for record in daily_records
    ]
    return build_multi_day_timeline_data(days_data, user)


async def _build_timeline_for_blog(db: AsyncSession, blog: Blog) -> dict:
    """블로그의 기록 + 유저 + 장소들을 timeline_data로 직렬화.

    period_end가 있으면 여러 날 payload, 없으면 기존 하루짜리 형식 그대로.
    """
    user = (await db.execute(select(User).where(User.id == blog.user_id))).scalar_one()

    if blog.period_end is not None:
        return await _build_multi_day_timeline(db, blog, user)

    daily_record = (
        await db.execute(
            select(DailyRecord).where(DailyRecord.id == blog.daily_record_id)
        )
    ).scalar_one_or_none()
    if daily_record is None:
        raise ValueError("하루 기록을 찾을 수 없습니다")

    places = await _load_places(db, blog.daily_record_id)

    return build_timeline_data(daily_record, user, places)


async def _check_quota(db: AsyncSession, user_id: uuid.UUID) -> None:
    """무료 사용자 주간 한도 검사 (프리미엄은 무제한).

    모아쓰기도 며칠을 묶든 생성 1회로 센다 — AI 호출이 한 번이기 때문.
    """
    subscription = await get_user_subscription(db, user_id)
    if not is_premium(subscription):
        used, reset_at = await get_weekly_usage(db, user_id)
        if used >= settings.FREE_WEEKLY_BLOG_LIMIT:
            raise QuotaExceededError(
                limit=settings.FREE_WEEKLY_BLOG_LIMIT, used=used, reset_at=reset_at
            )


async def create_blog_generation(
    db: AsyncSession, user_id: uuid.UUID, daily_record_id: uuid.UUID, style: str
) -> Blog:
    """블로그 생성 요청 → pending 상태로 DB 저장 (하루짜리)"""
    result = await db.execute(
        select(DailyRecord).where(
            DailyRecord.id == daily_record_id,
            DailyRecord.user_id == user_id,
        )
    )
    daily_record = result.scalar_one_or_none()
    if not daily_record:
        raise ValueError("해당 하루 기록을 찾을 수 없습니다")

    await _check_quota(db, user_id)

    # 같은 하루 기록으로 생성이 진행 중이면 중복 요청 거절 (완료/실패 건은 허용)
    # 삭제된 건은 사용자에게 안 보이므로 새 생성을 막으면 안 된다.
    in_progress = (
        await db.execute(
            select(Blog.id).where(
                Blog.user_id == user_id,
                Blog.daily_record_id == daily_record_id,
                Blog.deleted_at.is_(None),
                Blog.generation_status.in_(
                    [GenerationStatus.PENDING, GenerationStatus.GENERATING]
                ),
            )
        )
    ).first()
    if in_progress:
        raise BlogConflictError("이미 생성이 진행 중입니다")

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


STYLE_EXAMPLE_COUNT = 3  # 프롬프트에 넣을 최근 발행 글 수
STYLE_EXAMPLE_MAX_CHARS = 1500  # 글당 절단 길이 (프롬프트 비대 방지)


async def _get_style_examples(
    db: AsyncSession, user_id: uuid.UUID, exclude_blog_id: uuid.UUID
) -> list[str]:
    """유료 사용자의 최근 발행 글 본문 — AI가 문체를 따라 쓸 예시.

    무료 사용자는 빈 배열 (개인화 문체는 구독 혜택).
    """
    subscription = await get_user_subscription(db, user_id)
    if not is_premium(subscription):
        return []

    result = await db.execute(
        select(Blog.content)
        .where(
            Blog.user_id == user_id,
            Blog.is_published.is_(True),
            Blog.id != exclude_blog_id,
            Blog.content != "",
            # 삭제한 글을 문체 예시로 되살려 쓰면 안 된다
            Blog.deleted_at.is_(None),
        )
        .order_by(Blog.created_at.desc())
        .limit(STYLE_EXAMPLE_COUNT)
    )
    return [content[:STYLE_EXAMPLE_MAX_CHARS] for content in result.scalars()]


async def create_period_blog_generation(
    db: AsyncSession,
    user_id: uuid.UUID,
    start_date: date,
    end_date: date,
    style: str,
) -> Blog:
    """여러 날 모아쓰기 생성 요청 → pending 상태로 DB 저장.

    target_date가 시작일, period_end가 종료일이며 daily_record_id는 비운다.
    기간 유효성(역전·상한)은 요청 스키마에서 이미 검증된다.
    """
    await _check_quota(db, user_id)

    # 같은 기간으로 생성이 진행 중이면 중복 요청 거절 (하루짜리와 같은 규칙)
    in_progress = (
        await db.execute(
            select(Blog.id).where(
                Blog.user_id == user_id,
                Blog.target_date == start_date,
                Blog.period_end == end_date,
                Blog.deleted_at.is_(None),
                Blog.generation_status.in_(
                    [GenerationStatus.PENDING, GenerationStatus.GENERATING]
                ),
            )
        )
    ).first()
    if in_progress:
        raise BlogConflictError("이미 생성이 진행 중입니다")

    # 기간 안에 기록이 하나도 없으면 쓸 내용이 없으므로 404
    has_record = (
        await db.execute(
            select(DailyRecord.id).where(
                DailyRecord.user_id == user_id,
                DailyRecord.target_date >= start_date,
                DailyRecord.target_date <= end_date,
            )
        )
    ).first()
    if not has_record:
        raise ValueError("해당 기간에 기록이 없습니다")

    blog = Blog(
        user_id=user_id,
        daily_record_id=None,
        title="생성 중...",
        content="",
        style=style,
        target_date=start_date,
        period_end=end_date,
        generation_status=GenerationStatus.PENDING,
    )
    db.add(blog)
    await db.commit()
    await db.refresh(blog)
    return blog


async def run_blog_generation(blog_id: uuid.UUID, user_note: str | None = None) -> None:
    """BackgroundTask에서 실행 — 독립 세션으로 AI 호출 후 블로그 업데이트"""
    async with async_session() as db:
        result = await db.execute(select(Blog).where(Blog.id == blog_id))
        blog = result.scalar_one_or_none()
        if not blog:
            return

        blog.generation_status = GenerationStatus.GENERATING
        await db.commit()

        try:
            daily_record = await _build_timeline_for_blog(db, blog)
            style_examples = await _get_style_examples(db, blog.user_id, blog.id)
            ai_result = await request_blog_generation(
                daily_record=daily_record,
                style=map_style(blog.style),
                user_note=user_note,
                style_examples=style_examples,
            )

            # AI 프롬프트는 25자 권장이지만 강제가 아님 — DB 컬럼(255) 초과 방지 절단
            blog.title = ai_result.get("title", "제목 없음")[:255]
            blog.content = ai_result.get("content", "")
            blog.generation_status = GenerationStatus.COMPLETED

        except Exception as e:
            logger.error("블로그 생성 실패: blog_id=%s, error=%s", blog_id, e)
            blog.generation_status = GenerationStatus.FAILED

        await db.commit()


async def get_blog_by_id(
    db: AsyncSession, blog_id: uuid.UUID, user_id: uuid.UUID
) -> Blog:
    """블로그 단건 조회 (삭제된 글은 없는 것으로 취급)"""
    result = await db.execute(
        select(Blog).where(
            Blog.id == blog_id,
            Blog.user_id == user_id,
            Blog.deleted_at.is_(None),
        )
    )
    blog = result.scalar_one_or_none()
    if not blog:
        raise ValueError("블로그를 찾을 수 없습니다")
    return blog


SUMMARY_LENGTH = 100  # 목록 미리보기 길이


def build_summary(content: str | None, q: str | None = None) -> str | None:
    """목록 미리보기. 검색어가 본문에 있으면 그 주변을 잘라 보여준다.

    앞 100자만 보여주면 검색으로 찾은 단어가 화면에 안 나와 왜 걸렸는지 알 수 없다.
    제목·날짜로만 매치된 경우(본문에 검색어 없음)는 기존처럼 앞부분을 보여준다.
    """
    if not content:
        return None

    start = 0
    if q:
        idx = content.lower().find(q.lower())
        if idx != -1:
            # 매치를 가운데 두고 자른다
            start = max(0, idx - (SUMMARY_LENGTH - len(q)) // 2)

    end = min(len(content), start + SUMMARY_LENGTH)
    start = max(0, end - SUMMARY_LENGTH)  # 끝에 닿으면 앞으로 당겨 길이 유지

    snippet = content[start:end]
    prefix = "…" if start > 0 else ""
    suffix = "…" if end < len(content) else ""
    return f"{prefix}{snippet}{suffix}"


async def get_blog_list(
    db: AsyncSession,
    user_id: uuid.UUID,
    page: int = 1,
    size: int = 20,
    q: str | None = None,
    target_date: date | None = None,
) -> tuple[list[Blog], int]:
    """블로그 목록 조회 + 총 개수 (키워드 검색 / 날짜 필터 / 페이지네이션)"""
    # 삭제된 글은 목록·총개수 양쪽에서 제외 (filters를 두 쿼리가 공유한다)
    filters = [Blog.user_id == user_id, Blog.deleted_at.is_(None)]
    if q:
        keyword = f"%{q}%"
        # 화면에 보이는 날짜 표기(예: 26.08.06(wed))로도 검색되게 한다.
        # 포맷은 프론트 formatDate.ts와 동일해야 요일까지 걸린다.
        date_label = func.to_char(Blog.target_date, "YY.MM.DD(dy)")
        filters.append(
            or_(
                Blog.title.ilike(keyword),
                Blog.content.ilike(keyword),
                date_label.ilike(keyword),
            )
        )
    if target_date is not None:
        filters.append(Blog.target_date == target_date)

    count_result = await db.execute(
        select(func.count()).select_from(Blog).where(*filters)
    )
    total = count_result.scalar_one()

    result = await db.execute(
        select(Blog)
        .where(*filters)
        # created_at이 같은 글이 둘 이상이면 DB가 순서를 보장하지 않아,
        # 페이지 경계에서 같은 글이 두 번 나오거나 하나가 누락된다.
        .order_by(Blog.created_at.desc(), Blog.id.desc())
        .offset((page - 1) * size)
        .limit(size)
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

    if blog.generation_status in (
        GenerationStatus.PENDING,
        GenerationStatus.GENERATING,
    ):
        raise BlogConflictError("생성이 진행 중인 글은 수정할 수 없습니다")

    if title is not None:
        blog.title = title
    if content is not None:
        blog.content = content
    if visibility is not None:
        blog.visibility = visibility

    await db.commit()
    await db.refresh(blog)
    return blog


async def delete_blog(db: AsyncSession, blog_id: uuid.UUID, user_id: uuid.UUID) -> None:
    """블로그 소프트 삭제. 생성 횟수는 유지된다(팀 정책: 글을 받았으면 1회 사용).

    생성 중(pending/generating)이어도 삭제를 허용한다.
    백그라운드 작업은 완료될 때 generation_status만 바꾸고 deleted_at은 건드리지 않으므로,
    작업이 끝나도 이 글은 조회·목록에 다시 나타나지 않는다.
    """
    # 없는 글이거나 남의 글이거나 이미 삭제된 글이면 여기서 ValueError → 404
    blog = await get_blog_by_id(db, blog_id, user_id)

    blog.deleted_at = datetime.now(timezone.utc)
    await db.commit()


async def publish_blog(
    db: AsyncSession, blog_id: uuid.UUID, user_id: uuid.UUID
) -> Blog:
    """블로그 발행"""
    blog = await get_blog_by_id(db, blog_id, user_id)

    if blog.generation_status != GenerationStatus.COMPLETED:
        raise BlogStateError("생성이 완료된 블로그만 발행할 수 있습니다")

    blog.is_published = True
    blog.visibility = "public"
    await db.commit()
    await db.refresh(blog)
    return blog
