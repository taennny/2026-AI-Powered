# Roame 테스트 가이드

## 0. 사전 준비

- Docker Desktop
- Node.js 18 이상
- iOS 테스트: Mac + Xcode (시뮬레이터) 또는 실기기
- Android 테스트: Android Studio (에뮬레이터) 또는 실기기
- Expo Go 앱 설치 (실기기 간편 테스트용, GPS 백그라운드 기능 미지원)

```bash
# 1. 레포 클론
git clone https://github.com/taennny/2026-AI-Powered.git
cd 2026-AI-Powered

# 2. 각 폴더 환경변수 파일 생성
cd backend && cp .env.example .env && cd ..
cd frontend && cp .env.example .env && cd ..

# 3. 프론트엔드 의존성 설치
npm install

# iOS 실기기 또는 시뮬레이터로 테스트할 경우 pod install 필요:
cd ios && bundle exec pod install && cd ..
```

---

## 1. 백엔드 서버 실행

```bash
# 루트에서 Docker 컨테이너 실행
docker compose up --build
```

실행 후 아래 주소에서 백엔드가 활성화됐는지 확인합니다:
http://localhost:8000/docs

---

## 2. 프론트엔드 실행

```bash
# Metro 캐시 초기화 후 시작 (처음 실행 시 권장)
npx expo start -c

# iOS 시뮬레이터
npm run ios

# Android 에뮬레이터
npm run android
```

---

## 3. 흐름 테스트 - Mock 모드 테스트 시나리오 (`EXPO_PUBLIC_USE_MOCK=true`)

AI 연결 없음. 타임라인 확인, 지도 공유 기능 테스트
브라우저에서 http://localhost:8000/docs 접속 후 아래 순서대로 진행:

### Step 1: 로그인

1. POST /api/v1/auth/login 클릭
2. Request body에 아래 JSON 입력 후 "Try it out" 클릭

```json
{
  "email": "user@example.com",
  "password": "string"
}
```

3. Excute -> access_token 복사

### Step 2: 토큰 등록

1. 페이지 상단 Authorize 버튼 클릭
2. Value에 Bearer {복사한\_토큰} 입력 후 Authorize

### Step 3: 앱에서 로그인

1. Expo 앱(혹은 웹, 시뮬레이터)에서 이메일과 비밀번호 입력 후 로그인
2. 홈 화면에서 타임라인이 정상적으로 표시되는지 확인

### Step 4: 타임라인 조회 및 지도 공유 테스트

AI 미연동이라 현재는 프론트에서 mock 데이터를 사용합니다.

1. 5월 7일에 타임라인이 존재하는지 확인
2. 바텀시트를 올려 지도 미리보기 확인
3. 지도 이미지를 꾹 눌러 공유 기능 테스트

---

## 주의 사항

| 항목             | 내용                                                            |
| ---------------- | --------------------------------------------------------------- |
| Expo Go          | GPS 백그라운드 미지원. 포그라운드 테스트만 가능                 |
| 백그라운드 GPS   | `EXPO_PUBLIC_BG_GPS=true` + 시뮬레이터 빌드(`npm run ios`) 필요 |
| Google Maps 키   | `.env`에 없으면 지도 미리보기 대신 회색 박스 표시               |
| AI 타임라인 생성 | 현재 미연동 — mock 모드 또는 Swagger 직접 입력으로 테스트       |
