"""AI-3 — GPT 블로그 생성.

엔드포인트: POST /generate

백엔드 연동 계약 (backend/app/services/ai_client.py 기준)
  요청:  { "daily_record": { ... }, "style": "casual" | "emotional" | "info" }
  응답:  { "title": str, "content": str }

daily_record 표준 형식 (백엔드가 places + photos 를 조립해 전달해야 함):
  {
    "date": "2026-06-19",
    "user": { "nickname": str, "taste_tags": [str] },
    "blocks": [
      { "seq": int, "start": "HH:MM", "end": "HH:MM",
        "place": str, "category": str, "address": str,
        "expense": { "item": str, "amount": int } | null,
        "photos": int, "memo": str | null }
    ]
  }
"""

import logging
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


def _format_date(date_str: str) -> str:
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    return f"{dt.year}년 {dt.month}월 {dt.day}일 {_WEEKDAYS[dt.weekday()]}요일"


def serialize(data: dict) -> str:
    """daily_record 를 LLM 입력용 텍스트 타임라인으로 직렬화한다."""
    lines = [f"[날짜] {_format_date(data['date'])}"]
    user = data.get("user", {})
    taste = ", ".join(user.get("taste_tags", [])) or "없음"
    lines.append(f"[유저] {user.get('nickname', '')} | 관심사: {taste}")
    lines.append("")
    for block in data.get("blocks", []):
        lines.append(f"[블록 {block['seq']}] {block['start']}~{block['end']}")
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
    return "\n".join(lines).rstrip()


generate_input = ns.model(
    "GenerateInput",
    {
        "style": fields.String(required=True, description="casual / emotional / info"),
        "daily_record": fields.Raw(required=True, description="하루 기록 (date/user/blocks)"),
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

            if not daily_record:
                return {"error": "daily_record가 없습니다."}, 400
            if not daily_record.get("blocks"):
                return {"error": "daily_record.blocks가 비어 있습니다."}, 400
            if style not in PROMPTS:
                return {"error": "style은 casual, emotional, info 중 하나여야 합니다."}, 400
            if not settings.OPENAI_API_KEY:
                return {"error": "OPENAI_API_KEY가 설정되지 않았습니다."}, 500

            serialized = serialize(daily_record)
            system_prompt, user_template = PROMPTS[style]
            user_prompt = user_template.format(timeline=serialized)

            response = _get_client().chat.completions.create(
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

            logger.info("블로그 생성 완료 | title=%s", title)
            return {"title": title, "content": content}, 200

        except Exception as e:
            logger.error("블로그 생성 오류: %s", e)
            return {"error": str(e)}, 500
