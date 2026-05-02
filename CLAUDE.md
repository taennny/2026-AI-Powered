# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

Roame은 위치 기반 일상 기록 앱의 React Native (Expo) 프론트엔드입니다. 걷기 기반의 타임라인 기록 및 저널 작성 기능을 제공합니다.

## 주요 커맨드

```bash
npm install               # 의존성 설치
npm run start             # Expo 개발 서버 시작
npm run ios               # iOS 시뮬레이터 실행
npm run android           # Android 에뮬레이터 실행
npm run lint              # ESLint 검사
npm run lint:fix          # ESLint 자동 수정
npm run format            # Prettier 포맷팅

# iOS 네이티브 모듈 변경 후 필수
cd ios && bundle exec pod install && cd ..
```

## 아키텍처

### 라우팅 구조 (expo-router 파일 기반 라우팅)

```
app/
├── _layout.tsx                      # 루트 레이아웃: 폰트 로드, 스플래시 스크린 관리
├── index.tsx                        # 진입점: 권한 요청 + 토큰 확인 → (auth)/(main) 분기
├── (auth)/
│   ├── _layout.tsx
│   ├── login.tsx                    # 로그인
│   ├── signup.tsx                   # 회원가입
│   ├── find-password.tsx            # 비밀번호 찾기 (이메일 발송)
│   ├── reset-password.tsx           # 비밀번호 재설정 (token 쿼리 파라미터)
│   └── kakao-login.tsx              # 카카오 OAuth 콜백 처리
└── (main)/
    ├── (tabs)/
    │   ├── _layout.tsx              # 탭 공통 레이아웃: Header + SectionTabs + Slot + Footer
    │   ├── index.tsx                # (tabs) 진입 시 home으로 redirect
    │   ├── home/index.tsx           # 홈 탭 (Calendar + BottomSheet)
    │   └── journal-list/index.tsx   # 저널 리스트 탭 (검색 + ScrollView)
    ├── write/index.tsx              # 글쓰기 (프롬프트 입력 → AI 생성)
    ├── write-preview/index.tsx      # 글쓰기 미리보기/저장
    ├── journal-detail/index.tsx     # 저널 상세 화면
    └── settings/
        ├── index.tsx                # 설정 메인
        ├── account/index.tsx        # 계정 설정
        ├── subscription/index.tsx   # 구독 설정
        └── theme/index.tsx          # 테마 설정
```

### 인증 플로우

```
앱 시작
└── app/index.tsx
    ├── usePermissions().requestAll()   # 위치·미디어·카메라 권한 요청
    ├── authStore.initialize()          # tokenStorage → authStore 동기화
    ├── isAuthenticated → true  → /(main)/(tabs)/home
    └── isAuthenticated → false → /(auth)/login

로그인 성공
└── authApi.login() → saveTokens() + authStore.setToken()

로그아웃 (미연결)
└── authStore.logout() → removeTokens() + clearToken() → /(auth)/login
```

### 탭 네비게이션 패턴

`(tabs)/_layout.tsx`는 expo-router의 `<Slot />`을 사용해 `home`과 `journal-list` 두 화면 간 전환을 처리합니다. 탭 전환은 `SectionTabs` 컴포넌트에서 `router.replace()`로 구현되며, 실제 네이티브 탭바 대신 커스텀 탭 UI를 사용합니다. `HomeFooter`는 `usePathname()`으로 경로를 감지해 `home`에서만 렌더링합니다.

### API 레이어

모든 API 호출은 `utils/api.ts`의 axios 인스턴스를 통해 이루어집니다.

```
utils/api.ts              # axios 인스턴스 (baseURL: EXPO_PUBLIC_API_BASE_URL)
                          # 요청 인터셉터: Authorization Bearer 토큰 자동 첨부
                          # 응답 인터셉터: 401 시 refresh 토큰으로 재발급 후 재시도
utils/tokenStorage.ts     # AsyncStorage 기반 토큰 저장/조회/삭제

services/calendarApi.ts   # fetchCalendarMonth, fetchTimeline + 관련 타입
services/blogApi.ts       # fetchBlogs + 관련 타입
services/authApi.ts       # signup, login, refreshAccessToken, sendResetEmail, resetPassword
services/journalApi.ts    # uploadPhoto, generateJournal, saveJournal
services/subscriptionApi.ts  # fetchSubscription
```

**API 폴백 패턴**: 각 화면은 API 실패 시 빈 배열/0으로 폴백합니다. `EXPO_PUBLIC_API_BASE_URL`을 설정하면 실제 API로 전환됩니다 (기본값: `http://localhost:8000`).

### 현재 연결된 API 엔드포인트

| 엔드포인트 | 함수 | 사용처 |
|---|---|---|
| `POST /auth/signup` | `signup` | `(auth)/signup.tsx` |
| `POST /auth/login` | `login` | `(auth)/login.tsx` |
| `POST /auth/refresh` | 인터셉터 자동 처리 | `utils/api.ts` |
| `POST /auth/password/reset-email` | `sendResetEmail` | `(auth)/find-password.tsx` |
| `POST /auth/password/reset` | `resetPassword` | `(auth)/reset-password.tsx` |
| `GET /api/v1/calendar/{year}/{month}` | `fetchCalendarMonth` | `hooks/useCalendar.ts` |
| `GET /api/v1/calendar/{date}/timeline` | `fetchTimeline` | `hooks/useCalendar.ts` |
| `GET /api/v1/blogs` | `fetchBlogs` | `journal-list/index.tsx` |
| `POST /api/v1/photos/upload` | `uploadPhoto` | `(main)/write/index.tsx` |
| `POST /api/v1/journals/generate` | `generateJournal` | `(main)/write/index.tsx` |
| `POST /api/v1/journals` | `saveJournal` | `(main)/write-preview/index.tsx` |

### 스타일링

NativeWind v4 (Tailwind CSS for React Native)를 사용하지만, 색상·반경·그림자 등 디자인 토큰이 필요한 경우 반드시 `constants/Colors.ts`의 `Colors` 객체를 사용합니다. Tailwind 클래스와 인라인 `style` prop을 혼용하는 패턴이 있습니다.

**그림자**: RN 0.76+ 기준으로 `shadow*` props 대신 `boxShadow` 사용.
```tsx
// ❌ deprecated
shadowColor: '#000', shadowOffset: {width: 0, height: 1}, ...
// ✅ 올바른 방식
boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
```

### 색상 토큰 (`constants/Colors.ts`)

| 토큰 | 값 | 주요 용도 |
|---|---|---|
| `tealBg` | `#E6F0F1` | 시트·화면 배경 |
| `teal` | `#D8E6E8` | 타임라인 바, Journal 탭, 테두리 |
| `tealDark` | `#A0B4B8` | 드래그 핸들 |
| `tealAccent` | `#7BBFD4` | 선택 날짜, 이벤트 dot, 검색 하이라이트 |
| `textPrimary` | `#1a1a1a` | 기본 텍스트, 버튼 배경 |
| `textMedium` | `#374151` | 카드 서브 텍스트 |
| `textSecondary` | `#6b7280` | 보조 텍스트 |
| `textTertiary` | `#9ca3af` | 힌트·레이블 |
| `white` | `#FFFFFF` | Index 탭, 카드 배경 |
| `surface` | `#F6F6F6` | 헤더·푸터 배경 |
| `borderLight` | `#e5e7eb` | 캘린더 구분선 |

### 홈 화면 레이아웃 패턴

`home/index.tsx`에서 Calendar 고정 높이(`CALENDAR_HEIGHT_6_ROWS = 440`)를 기반으로 컨테이너 높이를 측정해 `peekHeight`를 계산합니다. BottomSheet는 `position: absolute`로 Calendar 위에 올라가며, 측정 전(`peekHeight === 0`)에는 렌더링하지 않습니다.

캘린더 데이터·타임라인 fetch 로직은 `hooks/useCalendar.ts`로 분리되어 있습니다. `viewDate` 변경 시 `fetchCalendarMonth`, `selectedDate` 변경 시 `fetchTimeline`을 호출합니다.

BottomSheet는 PanResponder로 3단계 스냅 포인트를 구현합니다:
- `0` — expanded (전체 화면)
- `sheetHeight - peekHeight` — peek (캘린더 아래 절반)
- `sheetHeight - 30` — handleOnly (핸들만 노출)

translateY가 `sheetHeight * 0.45` 미만일 때 MapPreview가 페이드인됩니다 (`isMapMounted` + `mapOpacity` 패턴으로 마운트/언마운트 관리).

### 저널 리스트 패턴

`journal-list/index.tsx`는 API fetch + 클라이언트 사이드 검색으로 구현됩니다:
- 초기 로드: `useEffect`에서 `fetchBlogs()` 호출, 실패 시 빈 배열 폴백
- 검색: `TextInput` 변경 → 클라이언트 필터링 (제목, 본문, 날짜)
- 검색창: 아이콘 탭 → `Animated.spring`으로 좌측 확장, X 탭 → 축소

### 글쓰기 플로우

```
HomeFooter 글쓰기 버튼 → /(main)/write
├── 프롬프트 입력 + 글쓰기 스타일 (정보 위주 / 감성적)
├── 사진 선택 (선택) → uploadPhoto()
├── generateJournal() → AI 글 생성
└── /(main)/write-preview (title, content, photoUrl 파라미터 전달)
    └── 제목/내용 수정 후 saveJournal() → 저장
```

### 상태 관리 (Zustand)

```
store/authStore.ts
  - accessToken: string | null
  - isAuthenticated: boolean
  - setToken(token)     # 로그인 후 호출 — tokenStorage 저장은 authApi.login()이 담당
  - clearToken()        # 수동 초기화
  - initialize()        # 앱 시작 시 tokenStorage 읽어서 store 동기화
  - logout()            # removeTokens() + clearToken() 일괄 처리

store/timelineStore.ts
  - totalDistance: number
  - setTotalDistance(distance)   # fetchTimeline 응답 후 호출
```

**핵심 패턴**: `tokenStorage`는 디스크(앱 재시작 후 유지), `authStore`는 메모리 상태(컴포넌트 리렌더 트리거). 로그인·로그아웃 시 반드시 둘 다 업데이트해야 합니다.

### 훅

```
hooks/usePermissions.ts   # requestAll() — 위치·미디어·카메라 권한 일괄 요청
hooks/useCalendar.ts      # selectedDate, viewDate, calendarDays, places + fetch 로직
hooks/useAuth.ts          # 빈 파일 (미구현)
```

### 유틸 (`utils/formatDate.ts`)

| 함수 | 변환 |
|---|---|
| `toDateKey(date)` | `Date` → `'YYYY-MM-DD'` |
| `formatDate(date)` | `Date` → `'YY.MM.DD(day)'` |
| `formatDateStr(str)` | `'YYYY-MM-DD'` → `'YY.MM.DD(day)'` |
| `formatTimeFromISO(iso)` | ISO 8601 → `'12:00PM'` |
| `formatTimeAgo(iso)` | ISO 8601 → `'방금'` / `'N분 전'` 등 |

### 경로 별칭

`@/`는 프로젝트 루트를 가리킵니다 (`tsconfig.json` 경로 설정).

## 미구현 / TODO 항목

| 항목 | 위치 | 비고 |
|---|---|---|
| 로그아웃 연결 | `settings/account/index.tsx` | `authStore.logout()` + `router.replace('/(auth)/login')` |
| GET /api/v1/users/me | `settings/account/index.tsx` | 이메일·카카오 연동 여부 동적 처리 |
| 카카오 SNS 연동 | `settings/account/index.tsx` | OAuth code → POST /api/v1/auth/kakao |
| journal-detail 연결 | `JournalCard`, `PostCard` | 탭 시 `/(main)/journal-detail` 이동 |
| GET /api/v1/blog/{id} | `journal-detail/index.tsx` | 상세 화면 구현 시 연결 |
| 테마 전역 적용 | `settings/theme/index.tsx` | store 저장 + 앱 전체 색상 전환 |
| 결제 플로우 | 구독 관련 컴포넌트 | `FreeView`, `SubscriptionModal` 버튼 연결 |
| 구독 해지 모달 | `PremiumView.tsx` | 확인 모달 + API 연결 |
| Kakao Static Map | `MapPreview.tsx` | 엔드포인트 `/v2/maps/static.png` 수정됨, 실기기 테스트 필요 |
| ScrollView ↔ BottomSheet 제스처 충돌 | `BottomSheet.tsx` | PanResponder 충돌 미해결 |
| useAuth 훅 | `hooks/useAuth.ts` | 빈 파일, 필요 시 구현 |
