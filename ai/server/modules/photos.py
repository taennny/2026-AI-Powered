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
    "stay_photo_summary": [ { "stay_seq": int, "photo_count": int,
                              "top_scenes": [str], "cover_photo_id": str | null } ]
  }

구현 단계
  - 2a: taken_at 기반 사진 → 체류 블록 매칭, 블록별 개수 집계.
  - 2b (현재): photo_url 로 이미지를 받아 CLIP 제로샷 분류 → scene/confidence 채움,
               잡사진(스크린샷·문서) 필터링 + 블록 대표 사진(cover) 선정.
  EXIF(시간·위치)는 백엔드가 이미 추출하므로 그대로 받아 사용한다.
  torch/transformers 미설치 시 분류는 건너뛰고 매칭만 동작한다 (graceful).
"""

import logging
from collections import Counter
from datetime import datetime, timezone

import requests
from flask import request
from flask_restx import Namespace, Resource, fields

from modules import clip_classifier

logger = logging.getLogger(__name__)

ns = Namespace(
    "photos",
    path="/api/ai",
    description="사진 블록 매칭 + CLIP 분류 (AI-2)",
)

IMAGE_DOWNLOAD_TIMEOUT = 10  # 초


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


def match_photos_to_stays(photos: list, stays: list) -> list:
    """사진을 촬영 시각 기준으로 체류 블록에 매칭한다.

    반환: [ { photo_id, stay_seq, scene, confidence } ] (scene/confidence 는 분류 전 None)
    """
    parsed_stays = [
        (s.get("seq"), _parse_dt(s.get("start")), _parse_dt(s.get("end"))) for s in stays
    ]

    per_photo = []
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
                "scene": None,
                "confidence": None,
            }
        )
    return per_photo


def _download_image(url: str):
    """URL 에서 이미지를 받아 RGB PIL 이미지로 반환한다. 실패 시 None."""
    try:
        from io import BytesIO

        from PIL import Image

        res = requests.get(url, timeout=IMAGE_DOWNLOAD_TIMEOUT)
        res.raise_for_status()
        return Image.open(BytesIO(res.content)).convert("RGB")
    except Exception as e:
        logger.warning("이미지 다운로드 실패 (%s): %s", url, e)
        return None


def classify_photos(photos: list, per_photo: list) -> None:
    """photo_url 이 있는 사진을 CLIP 으로 분류해 per_photo 의 scene/confidence 를 채운다.

    CLIP 미사용 가능(미설치/이미지 없음) 시 조용히 건너뛴다 (per_photo 그대로).
    """
    if not clip_classifier.is_available():
        logger.info("CLIP 미설치 — 분류 건너뜀 (매칭만 수행)")
        return

    images, ids = [], []
    for photo in photos:
        url = photo.get("photo_url")
        if not url:
            continue
        img = _download_image(url)
        if img is not None:
            images.append(img)
            ids.append(photo.get("photo_id"))

    if not images:
        return

    try:
        results = clip_classifier.classify(images)
    except Exception as e:
        logger.error("CLIP 분류 실패: %s", e)
        return

    scene_map = {pid: res for pid, res in zip(ids, results)}
    for pp in per_photo:
        if pp["photo_id"] in scene_map:
            pp["scene"], pp["confidence"] = scene_map[pp["photo_id"]]


def build_stay_summary(stays: list, per_photo: list) -> list:
    """블록별로 사진 개수 · 대표 scene · 대표 사진(cover)을 집계한다."""
    by_stay: dict = {}
    for pp in per_photo:
        by_stay.setdefault(pp["stay_seq"], []).append(pp)

    summary = []
    for stay in stays:
        seq = stay.get("seq")
        items = by_stay.get(seq, [])
        # 잡사진(문서·스크린샷)은 대표 scene/cover 에서 제외
        content = [
            p
            for p in items
            if p["scene"] and p["scene"] not in clip_classifier.JUNK_SCENES
        ]
        top_scenes = [s for s, _ in Counter(p["scene"] for p in content).most_common(2)]
        cover_photo_id = (
            max(content, key=lambda p: p["confidence"] or 0)["photo_id"]
            if content
            else None
        )
        summary.append(
            {
                "stay_seq": seq,
                "photo_count": len(items),
                "top_scenes": top_scenes,
                "cover_photo_id": cover_photo_id,
            }
        )
    return summary


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
        "photo_url": fields.String(description="이미지 접근 URL (CLIP 분류용)"),
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
        "cover_photo_id": fields.String,
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
        """사진을 체류 블록에 매칭하고 CLIP 으로 분류한다."""
        try:
            data = request.json or {}
            photos = data.get("photos", [])
            stays = data.get("stays", [])

            if not isinstance(photos, list) or not isinstance(stays, list):
                return {"error": "photos, stays는 리스트여야 합니다."}, 400

            per_photo = match_photos_to_stays(photos, stays)
            classify_photos(photos, per_photo)
            summary = build_stay_summary(stays, per_photo)

            classified = sum(1 for p in per_photo if p["scene"] is not None)
            logger.info(
                "사진 처리 완료 | 총 %d장, 분류 %d장", len(photos), classified
            )
            return {"photos": per_photo, "stay_photo_summary": summary}, 200

        except Exception as e:
            logger.error("사진 처리 오류: %s", e)
            return {"error": str(e)}, 500
