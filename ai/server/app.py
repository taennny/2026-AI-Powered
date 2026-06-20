"""Roame 통합 AI 추론 서버 진입점.

계획서의 "3개 AI 모듈을 통합 운영하는 추론 서버"를 단일 Flask 앱으로 구현한다.
백엔드는 단일 AI_SERVER_URL 로 아래 엔드포인트를 호출한다.

  POST /api/ai/analyze    (AI-1) GPS 체류 감지 + 장소 매칭
  POST /api/ai/classify   (AI-2) CLIP 사진 분류        ← 2단계 구현 예정
  POST /generate          (AI-3) GPT 블로그 생성
  GET  /health
  GET  /swagger           Swagger UI
"""

from dotenv import load_dotenv

load_dotenv()  # config / 모듈 import 전에 .env 로드

from flask import Flask, jsonify  # noqa: E402
from flask_cors import CORS  # noqa: E402
from flask_restx import Api  # noqa: E402

from config import settings  # noqa: E402
from modules.blog import ns as blog_ns  # noqa: E402
from modules.gps import ns as gps_ns  # noqa: E402
from modules.photos import ns as photos_ns  # noqa: E402

app = Flask(__name__)
CORS(app)

api = Api(
    app,
    version="1.0",
    title="Roame 통합 AI 추론 서버",
    description="GPS 체류 감지 · CLIP 사진 분류 · GPT 블로그 생성 통합 API",
    doc="/swagger",
)

api.add_namespace(gps_ns)
api.add_namespace(photos_ns)
api.add_namespace(blog_ns)


@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "roame-ai"}), 200


if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=settings.PORT)
