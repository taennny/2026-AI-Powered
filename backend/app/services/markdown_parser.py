import re
from typing import Literal

from app.schemas.blog import ParsedBlog, ParsedSection, TimelineBlock

_SECTION_RE = re.compile(r"^##\s+(.+)$")
_INFO_BOX_RE = re.compile(r"^✅\s+(.+)$")
_TABLE_ROW_RE = re.compile(r"^\|.+\|$")
_TIME_RE = re.compile(r"(\d{1,2}:\d{2})")


def _extract_seq_from_heading(heading: str, blocks: list[TimelineBlock]) -> int | None:
    """매칭: 소제목 안의 시간 또는 장소명으로 블록 seq 추적."""
    times = _TIME_RE.findall(heading)
    for block in blocks:
        if times and block.start in times:
            return block.seq
        if block.place in heading:
            return block.seq
    return None


def _photo_tags(seq: int, count: int) -> list[str]:
    """사진 수만큼 삽입 태그 생성. 태그는 [PHOTO:seq:index] 형식."""
    return [f"[PHOTO:{seq}:{i + 1}]" for i in range(count)]


def _photo_count_for_seq(seq: int | None, blocks: list[TimelineBlock]) -> int:
    if seq is None:
        return 0
    for b in blocks:
        if b.seq == seq:
            return b.photos
    return 0


def parse(raw: str, blocks: list[TimelineBlock], style: Literal["emotional", "info"]) -> ParsedBlog:
    lines = raw.strip().splitlines()

    title = lines[0].lstrip("# ").strip() if lines else ""
    body_lines = lines[1:] if lines else []

    sections: list[ParsedSection] = []
    total_table_lines: list[str] = []
    in_total_table = False

    current_heading: str | None = None
    current_seq: int | None = None
    current_body: list[str] = []
    current_info_box: str | None = None

    def flush_section():
        nonlocal current_heading, current_seq, current_body, current_info_box
        if not current_body and current_heading is None:
            return
        body_text = "\n".join(current_body).strip()
        tags = _photo_tags(current_seq, _photo_count_for_seq(current_seq, blocks)) if style == "info" else []
        sections.append(ParsedSection(
            seq=current_seq,
            heading=current_heading,
            body=body_text,
            info_box=current_info_box,
            photo_tags=tags,
        ))
        current_heading = None
        current_seq = None
        current_body = []
        current_info_box = None

    intro_body: list[str] = []
    in_intro = True

    for line in body_lines:
        # 총 지출 섹션 감지
        if re.match(r"^##\s*총\s*지출", line):
            flush_section()
            if intro_body:
                sections.insert(0, ParsedSection(seq=None, heading=None, body="\n".join(intro_body).strip()))
                intro_body = []
            in_intro = False
            in_total_table = True
            continue

        if in_total_table:
            total_table_lines.append(line)
            continue

        section_match = _SECTION_RE.match(line)
        if section_match:
            if in_intro and intro_body:
                sections.append(ParsedSection(seq=None, heading=None, body="\n".join(intro_body).strip()))
                intro_body = []
                in_intro = False
            else:
                flush_section()
                in_intro = False
            current_heading = section_match.group(1).strip()
            current_seq = _extract_seq_from_heading(current_heading, blocks)
            continue

        info_match = _INFO_BOX_RE.match(line)
        if info_match:
            current_info_box = info_match.group(1).strip()
            in_intro = False
            continue

        if in_intro:
            intro_body.append(line)
        else:
            current_body.append(line)

    if in_intro and intro_body:
        sections.append(ParsedSection(seq=None, heading=None, body="\n".join(intro_body).strip()))
    else:
        flush_section()

    # 감성 모드: 사진 태그 없음, 섹션 구분 없이 단일 본문
    if style == "emotional":
        return ParsedBlog(title=title, sections=sections, raw_content=raw)

    total_table = "\n".join(total_table_lines).strip() or None
    return ParsedBlog(title=title, sections=sections, total_expense_table=total_table, raw_content=raw)
