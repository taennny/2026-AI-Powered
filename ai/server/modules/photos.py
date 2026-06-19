"""AI-2 — 사진 처리 (블록 매칭 + CLIP 분류).

엔드포인트: POST /api/ai/classify

백엔드 연동 계약
  요청:  {
    "photos": [ { "photo_id": str, "taken_at": ISO8601 | null,
                  "lat": float | null, "lng": float | null,
                  "photo_url": str | null } ],
    "stays":  [ { "seq": int, "start": ISO8601, "end": ISO8601 } ]
  }
  응답:  {
    "photos": [ { "photo_id": str, "stay_seq": int | null,
                  "scene": str | null, "confidence": float | null } ],
    "stay_photo_summary": [ { "stay_seq": int, "photo_count": int, "top_scenes": [str] } ]
  }

구현 단계
  - 2a (현재): taken_at 기반 사진 → 체류 블록 매칭, 블록별 사진 개수 집계.
               EXIF(시간·위치)는 백엔드가 이미 추출하므로 그대로 받아 사용한다.
  - 2b (예정): photo_url 로 이미지를 받아 CLIP 제로샷 분류 → scene/confidence 채움,
               잡사진(스크린샷·문서) 필터링 및 블록 대표 사진 선정.
"""

import logging
from datetime import datetime, timezone

from flask import request
from flask_restx import Namespace, Resource, fields

logger = logging.getLogger(__name__)

ns = Namespace(
    "photos",
    path="/api/ai",
    description="사진 블록 매칭 + CLIP 분류 (AI-2)",
)


def _parse_dt(value: str | None) -> datetime | None:
    """ISO8601 문자열을 tz-naive UTC datetime 으로 파싱한다."""
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def match_photos_to_stays(photos: list, stays: list) -> tuple[list, list]:
    """사진을 촬영 시각 기준으로 체류 블록에 매칭한다.

    반환: (per_photo, summary)
      per_photo: [ { photo_id, stay_seq, scene, confidence } ]
      summary:   [ { stay_seq, photo_count, top_scenes } ]
    """
    parsed_stays = [
        (s.get("seq"), _parse_dt(s.get("start")), _parse_dt(s.get("end"))) for s in stays
    ]

    per_photo = []
    counts: dict = {}
    for photo in photos:
        taken_at = _parse_dt(photo.get("taken_at"))
        stay_seq = None
        if taken_at is not None:
            for seq, start, end in parsed_stays:
                if start is not None and end is not None and start <= taken_at <= end:
                    stay_seq = seq
                    break
        per_photo.append(
            {
                "photo_id": photo.get("photo_id"),
                "stay_seq": stay_seq,
                "scene": None,  # 2b CLIP 에서 채움
                "confidence": None,
            }
        )
        if stay_seq is not None:
            counts[stay_seq] = counts.get(stay_seq, 0) + 1

    summary = [
        {"stay_seq": s.get("seq"), "photo_count": counts.get(s.get("seq"), 0), "top_scenes": []}
        for s in stays
    ]
    return per_photo, summary


# ──────────────────────────────────────────
# API 모델 (Swagger 문서화)
# ──────────────────────────────────────────
photo_model = ns.model(
    "PhotoInput",
    {
        "photo_id": fields.String(required=True),
        "taken_at": fields.String(description="촬영 시각 (ISO 8601, 백엔드 EXIF)"),
        "lat": fields.Float(description="촬영 위도"),
        "lng": fields.Float(description="촬영 경도"),
        "photo_url": fields.String(description="이미지 접근 URL (2b CLIP용)"),
    },
)

stay_input_model = ns.model(
    "StayInput",
    {
        "seq": fields.Integer(required=True, description="체류 블록 순번"),
        "start": fields.String(required=True, description="체류 시작 (ISO 8601)"),
        "end": fields.String(required=True, description="체류 종료 (ISO 8601)"),
    },
)

classify_input = ns.model(
    "ClassifyInput",
    {
        "photos": fields.List(fields.Nested(photo_model), required=True),
        "stays": fields.List(fields.Nested(stay_input_model), required=True),
    },
)

photo_result_model = ns.model(
    "PhotoResult",
    {
        "photo_id": fields.String,
        "stay_seq": fields.Integer,
        "scene": fields.String,
        "confidence": fields.Float,
    },
)

stay_summary_model = ns.model(
    "StayPhotoSummary",
    {
        "stay_seq": fields.Integer,
        "photo_count": fields.Integer,
        "top_scenes": fields.List(fields.String),
    },
)

classify_output = ns.model(
    "ClassifyOutput",
    {
        "photos": fields.List(fields.Nested(photo_result_model)),
        "stay_photo_summary": fields.List(fields.Nested(stay_summary_model)),
    },
)


@ns.route("/classify")
class Classify(Resource):
    @ns.expect(classify_input)
    @ns.response(200, "성공", classify_output)
    @ns.response(400, "잘못된 요청")
    @ns.response(500, "서버 오류")
    def post(self):
        """사진을 체류 블록에 매칭하고 블록별 사진 개수를 집계한다. (2b: CLIP 분류 추가 예정)"""
        try:
            data = request.json or {}
            photos = data.get("photos", [])
            stays = data.get("stays", [])

            if not isinstance(photos, list) or not isinstance(stays, list):
                return {"error": "photos, stays는 리스트여야 합니다."}, 400

            per_photo, summary = match_photos_to_stays(photos, stays)

            matched = sum(1 for p in per_photo if p["stay_seq"] is not None)
            logger.info("사진 매칭 완료 | 총 %d장 중 %d장 블록 매칭", len(photos), matched)
            return {"photos": per_photo, "stay_photo_summary": summary}, 200

        except Exception as e:
            logger.error("사진 매칭 오류: %s", e)
            return {"error": str(e)}, 500
