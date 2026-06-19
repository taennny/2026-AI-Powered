# Roame 통합 AI 추론 서버

> 계획서의 "3개 AI 모듈을 통합 운영하는 추론 서버"를 단일 Flask 앱으로 구현.
> 백엔드는 단일 `AI_SERVER_URL` 로 아래 엔드포인트를 호출한다.

## 엔드포인트

| 모듈 | 메서드 | 경로               | 설명                             | 상태             |
| ---- | ------ | ------------------ | -------------------------------- | ---------------- |
| AI-1 | POST   | `/api/ai/analyze`  | GPS 체류 감지 + 카카오 장소 매칭 | ✅ baseline      |
| AI-2 | POST   | `/api/ai/classify` | 사진 블록 매칭 + CLIP 분류       | ✅ 매칭 / CLIP 2b 예정 |
| AI-3 | POST   | `/generate`        | GPT 블로그 생성                  | ✅               |
| -    | GET    | `/health`          | 헬스 체크                        | ✅               |
| -    | GET    | `/swagger`         | Swagger UI                       | ✅               |

## 백엔드 연동 계약

### POST /api/ai/analyze

```jsonc
// 요청
{ "user_id": "uuid", "gps_logs": [ { "time": "2026-06-19T10:00:00Z", "lat": 37.5, "lng": 127.0 } ] }
// 응답
{ "stays": [ { "place_name": "스타벅스", "category": "음식점 > 카페",
               "start": "2026-06-19T10:00:00", "end": "2026-06-19T10:40:00",
               "duration_min": 40, "lat": 37.5, "lng": 127.0 } ] }
```

### POST /api/ai/classify

```jsonc
// 요청 — 사진(EXIF는 백엔드가 추출)과 체류 블록을 넘김
{ "photos": [ { "photo_id": "uuid", "taken_at": "2026-06-19T10:15:00Z",
                "lat": 37.5, "lng": 127.0, "photo_url": "https://.../presigned" } ],
  "stays":  [ { "seq": 1, "start": "2026-06-19T10:00:00Z", "end": "2026-06-19T10:40:00Z" } ] }
// 응답 — 사진별 블록 매칭 + 블록별 집계 (scene/confidence 는 CLIP 2b 에서 채움)
{ "photos": [ { "photo_id": "uuid", "stay_seq": 1, "scene": null, "confidence": null } ],
  "stay_photo_summary": [ { "stay_seq": 1, "photo_count": 2, "top_scenes": [] } ] }
```

### POST /generate

```jsonc
// 요청
{ "style": "casual",
  "user_note": "오랜만에 친구 만난 날 (선택 필드, 없으면 타임라인만으로 생성)",
  "daily_record": {
    "date": "2026-06-19",
    "user": { "nickname": "태윤", "taste_tags": ["카페", "맛집"] },
    "blocks": [ { "seq": 1, "start": "10:00", "end": "10:40",
                  "place": "스타벅스", "category": "카페", "address": "서울 ...",
                  "expense": { "item": "아메리카노", "amount": 4500 },
                  "photos": 3, "memo": null } ]
  } }
// 응답
{ "title": "...", "content": "..." }
```

## 로컬 실행

```bash
cd ai/server
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # KAKAO_API_KEY, OPENAI_API_KEY 입력
python app.py          # http://localhost:5000/swagger
```

## 단계별 개발 계획

- **1단계 (완료)**: 통합 서버 골격 + 백엔드 계약 정합 (analyze / generate)
- **2a단계 (완료)**: 사진 → 체류 블록 시간기반 매칭 + 블록별 개수 집계 (`/api/ai/classify`)
- **2b단계**: CLIP 제로샷 분류로 scene/confidence 채움 + 잡사진 필터링 + 대표 사진 선정
- **3단계**: AI-1 체류 감지를 Isolation Forest + RandomForest 모델로 고도화
