"""AI-2 — CLIP 사진 분류 (2단계에서 구현 예정).

엔드포인트: POST /api/ai/classify

설계 계약 (2단계에서 확정):
  요청:  { "photos": [ { "photo_id": str, "url": str,
                         "taken_at": ISO8601 | null, "lat": float | null, "lng": float | null } ] }
  응답:  { "classifications": [ { "photo_id": str, "category": str, "confidence": float } ] }

현재는 골격 단계라 미구현(501)을 명시적으로 반환한다.
실제 구현: openai/clip-vit-base-patch32 제로샷 분류 + EXIF(시간·위치) 추출 후
체류 블록(blocks)에 타임스탬프로 매칭하여 blog.serialize 의 photos/category 를 채운다.
"""

import logging

from flask import request
from flask_restx import Namespace, Resource, fields

logger = logging.getLogger(__name__)

ns = Namespace(
    "photos",
    path="/api/ai",
    description="CLIP 사진 분류 (AI-2, 구현 예정)",
)

photo_model = ns.model(
    "PhotoInput",
    {
        "photo_id": fields.String(required=True),
        "url": fields.String(required=True, description="이미지 접근 URL"),
        "taken_at": fields.String(description="촬영 시각 (ISO 8601, EXIF 보완용)"),
        "lat": fields.Float(description="촬영 위도"),
        "lng": fields.Float(description="촬영 경도"),
    },
)

classify_input = ns.model(
    "ClassifyInput",
    {"photos": fields.List(fields.Nested(photo_model), required=True)},
)


@ns.route("/classify")
class Classify(Resource):
    @ns.expect(classify_input)
    @ns.response(200, "성공")
    @ns.response(501, "미구현 (2단계 예정)")
    def post(self):
        """사진을 장소·상황 카테고리로 분류한다. (2단계 구현 예정)"""
        _ = request.json
        logger.info("classify 호출됨 — 아직 미구현(2단계)")
        return {
            "error": "CLIP 사진 분류는 2단계에서 구현 예정입니다.",
            "classifications": [],
        }, 501
