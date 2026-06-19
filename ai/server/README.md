# Roame 통합 AI 추론 서버

> 계획서의 "3개 AI 모듈을 통합 운영하는 추론 서버"를 단일 Flask 앱으로 구현.
> 백엔드는 단일 `AI_SERVER_URL` 로 아래 엔드포인트를 호출한다.

## 엔드포인트

| 모듈 | 메서드 | 경로               | 설명                             | 상태             |
| ---- | ------ | ------------------ | -------------------------------- | ---------------- |
| AI-1 | POST   | `/api/ai/analyze`  | GPS 체류 감지 + 카카오 장소 매칭 | ✅ baseline      |
| AI-2 | POST   | `/api/ai/classify` | CLIP 사진 분류                   | 2단계 예정 (501) |
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

### POST /generate

```jsonc
// 요청
{ "style": "casual",
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
- **2단계**: AI-2 CLIP 사진 분류 구현 + EXIF 매칭 → blocks 채우기
- **3단계**: AI-1 체류 감지를 Isolation Forest + RandomForest 모델로 고도화
