# Roame Backend

> 걷기만 해도 내 하루가 기록된다. 여행이 되는 날엔, 블로그가 된다.

## 기술 스택

- **Framework**: Python 3.13 + FastAPI
- **Database**: PostgreSQL 16 + PostGIS
- **Storage**: MinIO (S3 호환, 추후 AWS S3로 전환)
- **Container**: Docker Compose

## 로컬 환경 세팅

### 사전 준비

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) 설치
- Git

### 시작하기
```bash
# 1. 레포 클론
git clone https://github.com/taennny/2026-AI-Powered.git
cd 2026-AI-Powered/backend

# 2. 환경변수 파일 생성
cp .env.example .env

# 3. Docker 컨테이너 실행
docker compose up --build

# 4. 확인
# API 서버: http://localhost:8000
# Swagger UI: http://localhost:8000/docs
# MinIO 콘솔: http://localhost:9001 (minioadmin / minioadmin123)
```

### 컨테이너 관리
```bash
# 백그라운드 실행
docker compose up -d

# 로그 확인
docker compose logs -f backend

# 종료
docker compose down

# DB 데이터까지 삭제하고 초기화
docker compose down -v
```

## 프로젝트 구조
```
backend/
├── app/
│   ├── main.py              # FastAPI 앱 진입점
│   ├── config.py            # 환경변수 설정
│   ├── database.py          # DB 연결
│   ├── models/              # SQLAlchemy 모델 (DB 테이블 정의)
│   ├── schemas/             # Pydantic 스키마 (요청/응답 형식)
│   ├── api/
│   │   └── v1/              # API v1 라우터
│   ├── services/            # 비즈니스 로직
│   └── utils/               # 유틸리티
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
└── .env.example
```

## API 문서

서버 실행 후 http://localhost:8000/docs 에서 Swagger UI 확인

## DB 마이그레이션

# 컨테이너 실행 후
docker compose exec backend alembic upgrade head

# 모델 추가 후 새 마이그레이션 생성
docker compose exec backend alembic revision --autogenerate -m "설명"
docker compose exec backend alembic upgrade head