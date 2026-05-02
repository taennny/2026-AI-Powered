import json
import uuid
from collections.abc import AsyncIterator
from datetime import datetime
from typing import Literal

from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.blog import Blog
from app.schemas.blog import BlogGenerateRequest, ParsedBlog
from app.services import markdown_parser, prompt_builder, timeline_serializer

_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


async def generate(
    style: Literal["info", "emotional", "casual"],
    timeline_data,
) -> dict[str, str]:
    """상대방 서버 연동용 — JSON {"title": ..., "content": ...} 반환."""
    serialized = timeline_serializer.serialize(timeline_data)
    system_prompt, user_prompt = prompt_builder.build(style, serialized)

    response = await _client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.8,
        max_tokens=2000,
    )

    raw = response.choices[0].message.content or ""
    lines = raw.strip().splitlines()
    title = lines[0].lstrip("# ").strip() if lines else ""
    content = "\n".join(lines[1:]).strip() if len(lines) > 1 else raw

    return {"title": title, "content": content}


async def _create_pending(req: BlogGenerateRequest, db: AsyncSession) -> Blog:
    target_date = datetime.strptime(req.timeline_data.date, "%Y-%m-%d").date()
    blog = Blog(
        id=uuid.uuid4(),
        user_id=req.user_id,
        daily_record_id=req.daily_record_id,
        title="",
        content="",
        style=req.style,
        target_date=target_date,
        generation_status="pending",
    )
    db.add(blog)
    await db.commit()
    await db.refresh(blog)
    return blog


async def _update_blog(blog: Blog, title: str, content: str, status: str, db: AsyncSession) -> None:
    blog.title = title
    blog.content = content
    blog.generation_status = status
    await db.commit()


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


async def generate_stream(req: BlogGenerateRequest, db: AsyncSession) -> AsyncIterator[str]:
    blog = await _create_pending(req, db)
    yield _sse("init", {"blog_id": str(blog.id), "status": "generating"})

    blog.generation_status = "generating"
    await db.commit()

    serialized = timeline_serializer.serialize(req.timeline_data)
    system_prompt, user_prompt = prompt_builder.build(req.style, serialized)

    accumulated = ""
    title = ""

    try:
        stream = await _client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            stream=True,
            temperature=0.8,
            max_tokens=2000,
        )

        async for chunk in stream:
            delta = chunk.choices[0].delta.content or ""
            if not delta:
                continue
            accumulated += delta

            if not title and "\n" in accumulated:
                first_line = accumulated.split("\n")[0].lstrip("# ").strip()
                if first_line:
                    title = first_line
                    yield _sse("title", {"title": title})

            yield _sse("chunk", {"content": delta})

        parsed: ParsedBlog = markdown_parser.parse(
            accumulated, req.timeline_data.blocks, req.style
        )
        if not title:
            title = parsed.title

        await _update_blog(blog, title, accumulated, "completed", db)
        yield _sse("done", {
            "blog_id": str(blog.id),
            "title": title,
            "status": "completed",
            "sections": len(parsed.sections),
        })

    except Exception as exc:
        await _update_blog(blog, title or "생성 실패", accumulated, "failed", db)
        yield _sse("error", {"blog_id": str(blog.id), "message": str(exc)})
