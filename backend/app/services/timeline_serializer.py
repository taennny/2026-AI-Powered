from datetime import datetime

from app.schemas.blog import TimelineData, TimelineBlock

_WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"]


def _format_date(date_str: str) -> str:
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    weekday = _WEEKDAYS[dt.weekday()]
    return f"{dt.year}년 {dt.month}월 {dt.day}일 {weekday}요일"


def _format_address_short(address: str) -> str:
    """서울 성동구 성수동2가 289-9 → 서울 성동구 성수동"""
    parts = address.split()
    return " ".join(parts[:3]) if len(parts) >= 3 else address


def _format_expense(block: TimelineBlock) -> str:
    if block.expense is None:
        return "없음"
    return f"{block.expense.item} {block.expense.amount:,}원"


def serialize(data: TimelineData) -> str:
    lines: list[str] = []

    lines.append(f"[날짜] {_format_date(data.date)}")
    taste = ", ".join(data.user.taste_tags) if data.user.taste_tags else "없음"
    lines.append(f"[유저] {data.user.nickname} | 관심사: {taste}")
    lines.append("")

    for block in data.blocks:
        lines.append(f"[블록 {block.seq}] {block.start}~{block.end}")
        lines.append(
            f"장소: {block.place} ({block.category}) / {_format_address_short(block.address)}"
        )
        lines.append(f"소비: {_format_expense(block)}")
        lines.append(f"사진: {block.photos}장")
        if block.memo:
            lines.append(f"메모: {block.memo}")
        lines.append("")

    return "\n".join(lines).rstrip()
