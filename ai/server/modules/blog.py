"""AI-3 — GPT 블로그 생성.

엔드포인트: POST /generate

백엔드 연동 계약 (backend/app/services/ai_client.py 기준)
  요청:  { "daily_record": { ... }, "style": "casual" | "emotional" | "info",
           "user_note": str | null (선택), "style_examples": [str] (선택) }
  응답:  { "title": str, "content": str }

user_note: 사용자가 글쓰기 화면에서 직접 입력한 메모(단어~몇 문장).
  값이 있으면 생성 프롬프트에 자연스럽게 반영하고, 없으면 타임라인만으로 생성한다.

style_examples: 유료 사용자의 최근 발행 글 본문(문체 참고용). 있으면 어투만
  따라 쓰고 내용은 이번 데이터만 사용한다. 없거나 빈 배열이면 무시.

daily_record 형식 — 하루(레거시) / 여러 날(days) 둘 다 지원:
  # 하루
  { "date": "2026-06-19",
    "user": { "nickname": str, "taste_tags": [str] },
    "blocks": [ {seq,start,end,place,category,address,expense,photos,memo} ] }
  # 여러 날 (한 편의 글로 묶기)
  { "user": { ... },
    "days": [ { "date": "2026-08-05", "blocks": [ ... ] },
              { "date": "2026-08-06", "blocks": [ ... ] } ] }
  ※ block.start/end 는 이미 현지 "HH:MM" (백엔드가 timezone 변환 완료).
"""

import json
import logging
import re
from datetime import datetime

from flask import request
from flask_restx import Namespace, Resource, fields
from openai import OpenAI

from config import settings

logger = logging.getLogger(__name__)

ns = Namespace(
    "blog",
    path="/",
    description="동선·사진 데이터 기반 블로그 생성 (AI-3)",
)

_WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"]
_client: OpenAI | None = None


def _get_client() -> OpenAI:
    """OpenAI 클라이언트 지연 초기화 (키 없을 때 import 단계 실패 방지)."""
    global _client
    if _client is None:
        _client = OpenAI(api_key=settings.OPENAI_API_KEY)
    return _client


PROMPTS = {
    "casual": (
        "당신은 친구에게 오늘 하루를 편하게 이야기하듯 쓰는 블로거입니다. 구어체로 써주세요. 없는 내용은 지어내지 마세요.",
        "{timeline}\n\n위 데이터로 캐주얼한 블로그를 작성하세요.\n제목: 오늘 하루를 한 문장으로\n분량: 600~900자\n말투: ~했어, ~이야 (반말체)",
    ),
    "emotional": (
        "당신은 담백한 일상 에세이를 쓰는 블로거입니다. 직접적 감정 단어는 사용하지 마세요.",
        "{timeline}\n\n위 데이터로 감성 에세이를 작성하세요.\n제목: 그날의 감각이 담긴 짧은 문장\n분량: 700~900자\n말투: ~했다, ~이었다 (일기체)",
    ),
    "info": (
        "당신은 네이버 블로그 스타일 정보성 포스팅을 쓰는 작가입니다. 주어진 정보만 사용하세요.",
        "{timeline}\n\n위 데이터로 정보성 블로그를 작성하세요.\n제목: [지역] [장소유형] | [핵심장소] 후기\n분량: 800~1200자\n말투: ~했어요 (해요체)",
    ),
}


def _parse_date(date_str: str) -> datetime | None:
    try:
        return datetime.strptime(date_str, "%Y-%m-%d")
    except (ValueError, TypeError):
        return None


def _format_date(date_str: str) -> str:
    dt = _parse_date(date_str)
    if dt is None:
        return date_str or ""
    return f"{dt.year}년 {dt.month}월 {dt.day}일 {_WEEKDAYS[dt.weekday()]}요일"


def _format_date_short(date_str: str) -> str:
    dt = _parse_date(date_str)
    if dt is None:
        return date_str or ""
    return f"{dt.month}월 {dt.day}일({_WEEKDAYS[dt.weekday()]})"


def _normalize_days(data: dict) -> list[dict]:
    """단일/멀티 형식을 [{date, blocks}] 리스트로 통일한다.

    - 멀티: data["days"] 그대로
    - 레거시 단일: {date, blocks} → [{date, blocks}]
    """
    if data.get("days"):
        return data["days"]
    return [{"date": data.get("date"), "blocks": data.get("blocks", [])}]


def _has_blocks(data: dict) -> bool:
    """단일/멀티 어느 형식이든 실제 블록이 하나라도 있는지."""
    return any(day.get("blocks") for day in _normalize_days(data))


def _serialize_block(block: dict) -> list[str]:
    lines = [f"[블록 {block['seq']}] {block['start']}~{block['end']}"]
    address_head = " ".join(block.get("address", "").split()[:3])
    lines.append(f"장소: {block['place']} ({block['category']}) / {address_head}")
    expense = block.get("expense")
    lines.append(
        f"소비: {expense['item']} {expense['amount']:,}원" if expense else "소비: 없음"
    )
    lines.append(f"사진: {block.get('photos', 0)}장")
    if block.get("memo"):
        lines.append(f"메모: {block['memo']}")
    lines.append("")
    return lines


def serialize(data: dict) -> str:
    """daily_record(단일/멀티)를 LLM 입력용 텍스트 타임라인으로 직렬화한다."""
    days = _normalize_days(data)
    multi = len(days) > 1

    user = data.get("user", {})
    taste = ", ".join(user.get("taste_tags", [])) or "없음"

    if multi:
        header = (
            f"[기간] {_format_date(days[0].get('date'))} ~ "
            f"{_format_date(days[-1].get('date'))} · 총 {len(days)}일"
        )
    else:
        header = f"[날짜] {_format_date(days[0].get('date'))}"

    lines = [header, f"[유저] {user.get('nickname', '')} | 관심사: {taste}", ""]

    for i, day in enumerate(days, start=1):
        if multi:
            lines.append(f"── {i}일차 · {_format_date_short(day.get('date'))} ──")
        for block in day.get("blocks", []):
            lines.extend(_serialize_block(block))
    return "\n".join(lines).rstrip()


USER_NOTE_MAX_LEN = 1000  # 과도한 입력 방지 (초과분은 잘림)

# 모델이 제목/본문을 JSON 으로 깔끔하게 분리해 반환하도록 강제하는 지시.
# response_format=json_object 사용을 위해 프롬프트에 "JSON" 이 포함돼야 한다.
OUTPUT_INSTRUCTION = (
    "\n\n[출력 형식] 아래 JSON 하나만 출력하세요 (코드블록·설명 없이):\n"
    '{"title": "제목", "content": "본문"}\n'
    "- title: 위 스타일의 제목 지시를 따르되 글 전체를 아우르는 간결한 제목. "
    "한 문장 또는 짧은 문구(25자 이내 권장), 마침표로 끝내지 말고 "
    "따옴표·해시(#)·'제목:' 같은 접두어를 넣지 마세요.\n"
    "- content: 본문만 담고, 제목을 본문 첫 줄에 반복하지 마세요."
)


STYLE_EXAMPLE_MAX_COUNT = 3  # 프롬프트에 넣을 예시 글 최대 개수
STYLE_EXAMPLE_MAX_CHARS = 1500  # 예시 글당 절단 길이


def _multiday_instruction(n_days: int) -> str:
    """여러 날을 한 편의 글로 엮도록 지시. 위 스타일의 '하루' 프레임을 덮어쓴다."""
    max_len = min(700 * n_days, 2400)
    return (
        f"\n\n※ 이 기록은 {n_days}일간의 여정입니다. 위 지시의 '오늘 하루' 프레임은 무시하고, "
        f"각 날을 따로 나열하지 말고 {n_days}일 전체를 하나의 흐름으로 자연스럽게 이어 한 편의 "
        "글로 쓰세요. 날짜 전환은 '다음 날', '이튿날'처럼 부드럽게 하고, 제목은 특정 하루가 "
        f"아니라 여정 전체를 아우르게. 분량은 최대 {max_len}자 내외."
    )


def _style_examples_instruction(examples: list) -> str:
    """유료 사용자의 예전 글을 '문체 참고'로 주입. 내용 복제는 금지한다."""
    picked = [e.strip()[:STYLE_EXAMPLE_MAX_CHARS] for e in examples if e and e.strip()]
    picked = picked[:STYLE_EXAMPLE_MAX_COUNT]
    if not picked:
        return ""
    joined = "\n\n---\n\n".join(picked)
    return (
        "\n\n[문체 참고] 아래는 이 사용자가 예전에 쓴 글입니다. 어투·문장 길이·표현 습관 등 "
        "'문체'만 참고해 비슷한 느낌으로 쓰세요. 단, 예전 글의 내용·소재·장소·사실은 절대 "
        "가져오지 말고 이번 데이터에 있는 것만 사용하세요:\n\n" + joined
    )


def compose_user_prompt(
    daily_record: dict,
    style: str,
    user_note: str = "",
    style_examples: list | None = None,
) -> str:
    """타임라인 + (선택) 멀티데이/문체참고/사용자메모를 합쳐 LLM user 프롬프트 생성."""
    days = _normalize_days(daily_record)
    _, user_template = PROMPTS[style]
    user_prompt = user_template.format(timeline=serialize(daily_record))

    if len(days) > 1:
        user_prompt += _multiday_instruction(len(days))

    if style_examples:
        user_prompt += _style_examples_instruction(style_examples)

    note = (user_note or "").strip()[:USER_NOTE_MAX_LEN]
    if note:
        user_prompt += (
            "\n\n[작성자 메모] 아래 내용을 글에 자연스럽게 반영하세요. "
            "단, 메모에 없는 사실을 지어내지는 마세요:\n" + note
        )
    return user_prompt + OUTPUT_INSTRUCTION


_TITLE_PREFIXES = ("제목:", "제목 :", "title:")


def _clean_title(title: str) -> str:
    """제목에서 접두어·따옴표·해시·끝 마침표 등 군더더기를 반복 제거한다."""
    t = (title or "").strip()
    prev = None
    while t and t != prev:
        prev = t
        t = t.strip().strip("#").strip("\"'“”").strip()
        for prefix in _TITLE_PREFIXES:
            if t.lower().startswith(prefix):
                t = t[len(prefix):].strip()
        t = t.rstrip("。.").strip()
    return t


def _strip_code_fence(text: str) -> str:
    """```json ... ``` 형태의 코드블록 펜스를 벗겨 안쪽 내용만 반환한다."""
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.DOTALL)
    return fence.group(1).strip() if fence else text


def parse_generation(raw: str) -> tuple[str, str]:
    """모델 응답에서 (title, content) 추출.

    1순위: JSON({"title","content"}) 파싱.
    실패 시 폴백: 첫 줄=제목, 나머지=본문 (구버전 방식).
    """
    text = _strip_code_fence((raw or "").strip())
    try:
        obj = json.loads(text)
        title = str(obj.get("title", "")).strip()
        content = str(obj.get("content", "")).strip()
        if title or content:
            return _clean_title(title), content
    except (json.JSONDecodeError, AttributeError, TypeError):
        pass

    lines = text.splitlines()
    title = _clean_title(lines[0]) if lines else ""
    content = "\n".join(lines[1:]).strip() if len(lines) > 1 else text
    return title, content


generate_input = ns.model(
    "GenerateInput",
    {
        "style": fields.String(required=True, description="casual / emotional / info"),
        "daily_record": fields.Raw(
            required=True,
            description="하루({date,user,blocks}) 또는 여러 날({user,days:[...]})",
        ),
        "user_note": fields.String(
            required=False, description="사용자 입력 메모 (선택). 있으면 생성에 반영"
        ),
        "style_examples": fields.List(
            fields.String,
            required=False,
            description="유료 사용자 최근 발행 글 (선택, 문체 참고용)",
        ),
    },
)

generate_output = ns.model(
    "GenerateOutput",
    {"title": fields.String, "content": fields.String},
)


@ns.route("/generate")
class Generate(Resource):
    @ns.expect(generate_input)
    @ns.response(200, "성공", generate_output)
    @ns.response(400, "잘못된 요청")
    @ns.response(500, "서버 오류")
    def post(self):
        """daily_record 를 받아 선택한 문체의 블로그를 생성한다."""
        try:
            data = request.json or {}
            style = data.get("style", "casual")
            daily_record = data.get("daily_record")
            user_note = data.get("user_note")  # 선택 필드
            style_examples = data.get("style_examples")  # 선택 (유료 문체 참고)

            if not daily_record:
                return {"error": "daily_record가 없습니다."}, 400
            if not _has_blocks(daily_record):
                return {"error": "daily_record에 blocks가 없습니다."}, 400
            if style not in PROMPTS:
                return {"error": "style은 casual, emotional, info 중 하나여야 합니다."}, 400
            if not settings.OPENAI_API_KEY:
                return {"error": "OPENAI_API_KEY가 설정되지 않았습니다."}, 500

            system_prompt, _ = PROMPTS[style]
            user_prompt = compose_user_prompt(
                daily_record, style, user_note, style_examples
            )

            response = _get_client().chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.8,
                max_tokens=4000,  # 멀티데이 최대 ~2400자 대응
                response_format={"type": "json_object"},
            )

            raw = response.choices[0].message.content or ""
            title, content = parse_generation(raw)

            logger.info("블로그 생성 완료 | title=%s", title)
            return {"title": title, "content": content}, 200

        except Exception as e:
            logger.error("블로그 생성 오류: %s", e)
            # 내부 예외 메시지는 로그에만, 응답은 일반 메시지 (내부정보 노출 방지)
            return {"error": "블로그 생성 중 오류가 발생했습니다."}, 500
