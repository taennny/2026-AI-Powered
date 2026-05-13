from flask import Flask, request, jsonify
from flask_restx import Api, Resource, fields
from flask_cors import CORS
from dotenv import load_dotenv
from openai import OpenAI
from datetime import datetime
import os
import logging

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

api = Api(app, version="1.0", title="Roame AI 3 — LLM API",
    description="타임라인 데이터 기반 블로그 생성 API", doc="/swagger")

ns = api.namespace("", description="블로그 생성")
client = OpenAI(api_key=OPENAI_API_KEY)

_WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"]

def serialize(data):
    lines = []
    lines.append(f"[날짜] {_format_date(data['date'])}")
    user = data.get("user", {})
    taste = ", ".join(user.get("taste_tags", [])) or "없음"
    lines.append(f"[유저] {user.get('nickname', '')} | 관심사: {taste}")
    lines.append("")
    for block in data.get("blocks", []):
        lines.append(f"[블록 {block['seq']}] {block['start']}~{block['end']}")
        lines.append(f"장소: {block['place']} ({block['category']}) / {' '.join(block['address'].split()[:3])}")
        expense = block.get("expense")
        lines.append(f"소비: {expense['item']} {expense['amount']:,}원" if expense else "소비: 없음")
        lines.append(f"사진: {block.get('photos', 0)}장")
        if block.get("memo"):
            lines.append(f"메모: {block['memo']}")
        lines.append("")
    return "\n".join(lines).rstrip()

def _format_date(date_str):
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    return f"{dt.year}년 {dt.month}월 {dt.day}일 {_WEEKDAYS[dt.weekday()]}요일"

PROMPTS = {
    "casual": ("당신은 친구에게 오늘 하루를 편하게 이야기하듯 쓰는 블로거입니다. 구어체로 써주세요. 없는 내용은 지어내지 마세요.",
               "{timeline}\n\n위 데이터로 캐주얼한 블로그를 작성하세요.\n제목: 오늘 하루를 한 문장으로\n분량: 600~900자\n말투: ~했어, ~이야 (반말체)"),
    "emotional": ("당신은 담백한 일상 에세이를 쓰는 블로거입니다. 직접적 감정 단어는 사용하지 마세요.",
                  "{timeline}\n\n위 데이터로 감성 에세이를 작성하세요.\n제목: 그날의 감각이 담긴 짧은 문장\n분량: 700~900자\n말투: ~했다, ~이었다 (일기체)"),
    "info": ("당신은 네이버 블로그 스타일 정보성 포스팅을 쓰는 작가입니다. 주어진 정보만 사용하세요.",
             "{timeline}\n\n위 데이터로 정보성 블로그를 작성하세요.\n제목: [지역] [장소유형] | [핵심장소] 후기\n분량: 800~1200자\n말투: ~했어요 (해요체)"),
}

generate_input = api.model("GenerateInput", {
    "style": fields.String(required=True, description="casual / emotional / info"),
    "timeline_data": fields.Raw(required=True),
})

@ns.route("/generate")
class Generate(Resource):
    @ns.expect(generate_input)
    def post(self):
        try:
            data = request.json or {}
            style = data.get("style", "casual")
            timeline_data = data.get("timeline_data")

            if not timeline_data:
                return {"error": "timeline_data가 없습니다."}, 400
            if style not in PROMPTS:
                return {"error": "style은 casual, emotional, info 중 하나여야 합니다."}, 400
            if not OPENAI_API_KEY:
                return {"error": "OPENAI_API_KEY가 설정되지 않았습니다."}, 500

            serialized = serialize(timeline_data)
            system_prompt, user_template = PROMPTS[style]
            user_prompt = user_template.format(timeline=serialized)

            response = client.chat.completions.create(
                model=OPENAI_MODEL,
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
            logger.error("오류: %s", e)
            return {"error": str(e)}, 500

@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "roame-ai-3-llm"}), 200

if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=5002)
