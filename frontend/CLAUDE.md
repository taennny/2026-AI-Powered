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
├── _layout.tsx                      # 루트 레이아웃: 폰트 로드, 스플래시 스크린 관리, ThemeRoot
├── index.tsx                        # 진입점: 권한 요청 + 토큰 확인 → (auth)/(main) 분기
├── (auth)/
│   ├── _layout.tsx
│   ├── login.tsx                    # 로그인
│   ├── signup.tsx                   # 회원가입
│   ├── find-password.tsx            # 비밀번호 찾기 (이메일 발송)
│   ├── reset-password.tsx           # 비밀번호 재설정 (token 쿼리 파라미터)
│   └── kakao-login.tsx              # 카카오 OAuth 딥링크 콜백 처리
└── (main)/
    ├── (tabs)/
    │   ├── _layout.tsx              # 탭 공통 레이아웃: Header + SectionTabs + Slot + Footer
    │   ├── index.tsx                # (tabs) 진입 시 home으로 redirect
    │   ├── home/index.tsx           # 홈 탭 (Calendar + BottomSheet)
    │   └── journal-list/index.tsx   # 저널 리스트 탭 (검색 + ScrollView)
    ├── write/index.tsx              # 글쓰기 (프롬프트 입력 → AI 생성)
    ├── write-preview/index.tsx      # 미리보기/저장 — 생성 직후 진입, 리스트에서 진입 시 상세 조회
    └── settings/
        ├── index.tsx                # 설정 메인
        ├── account/index.tsx        # 계정 설정
        ├── subscription/index.tsx   # 구독 설정
        └── theme/index.tsx          # 테마 설정
```

### 인증 플로우

```
앱 시작
└── app/index.tsx → hooks/useBootstrap.ts (준비 작업은 전부 여기에)
    ├── usePermissions().requestAll()   # 위치·미디어·카메라 권한 요청
    ├── authStore.initialize()          # tokenStorage → authStore 동기화
    ├── isAuthenticated → false → /(auth)/login
    └── isAuthenticated → true  → useGpsTracking().start()
        └── onboardingStorage 확인 → /onboarding 또는 /(main)/(tabs)/home

app/index.tsx는 useBootstrap이 반환한 목적지로 replace만 한다.

로그인 성공
└── authApi.login() → saveTokens() + authStore.setToken()

로그아웃
└── authStore.logout() → removeTokens() + clearToken() → /(auth)/login

카카오 로그인
└── WebBrowser.openAuthSessionAsync() → 백엔드 리다이렉트
    → roameapp://kakao-login?accessToken=...&refreshToken=...
    → kakao-login.tsx: saveTokens() + setToken() → 홈
    → source=account-link 시 → settings/account로 복귀
```

### API 레이어

모든 API 호출은 `utils/api.ts`의 axios 인스턴스를 통해 이루어집니다.

```
utils/api.ts              # axios 인스턴스 (baseURL: EXPO_PUBLIC_API_BASE_URL)
                          # 기본 타임아웃 15초, UPLOAD_TIMEOUT_MS(60초)는 업로드용으로 export
                          # 요청 인터셉터: Authorization Bearer 토큰 자동 첨부
                          # 응답 인터셉터: 401 시 refresh 토큰으로 재발급 후 재시도
utils/tokenStorage.ts     # AsyncStorage 기반 토큰 저장/조회/삭제

services/calendarApi.ts   # fetchCalendarMonth, fetchTimeline + 관련 타입
services/blogApi.ts       # fetchBlogs, generateBlog, waitForBlogGeneration,
                          # fetchBlogDetail, updateBlog, uploadPhoto + 관련 타입
services/authApi.ts       # signup, login, refreshAccessToken, sendResetEmail, resetPassword
services/gpsApi.ts        # uploadGpsLogs, analyzeGpsLogs
services/subscriptionApi.ts  # fetchSubscription
```

### 현재 연결된 API 엔드포인트

| 엔드포인트 | 함수 | 사용처 |
|---|---|---|
| `POST /api/v1/auth/register` | `signup` | `(auth)/signup.tsx` |
| `POST /api/v1/auth/login` | `login` | `(auth)/login.tsx` |
| `POST /api/v1/auth/refresh` | 인터셉터 자동 처리 | `utils/api.ts` |
| `POST /api/v1/auth/password-reset/request` | `sendResetEmail` | `(auth)/find-password.tsx` |
| `POST /api/v1/auth/password-reset/confirm` | `resetPassword` | `(auth)/reset-password.tsx` |
| `GET /api/v1/calendar/{year}/{month}` | `fetchCalendarMonth` | `hooks/useCalendar.ts` |
| `GET /api/v1/calendar/{date}/timeline` | `fetchTimeline` | `hooks/useCalendar.ts` |
| `GET /api/v1/blogs` | `fetchBlogs` | `journal-list/index.tsx` |
| `POST /api/v1/gps/logs` | `uploadGpsLogs` | `tasks/gpsTask.ts` |
| `POST /api/v1/gps/logs/{date}/analyze` | `analyzeGpsLogs` | `tasks/gpsTask.ts` |
| `POST /api/v1/photos/upload` | `uploadPhoto` | `(main)/write-preview/index.tsx` |
| `POST /api/v1/blog/generate` | `generateBlog` | `(main)/write/index.tsx` |
| `GET /api/v1/blogs/{id}/status` | `fetchBlogGenerationStatus` | `waitForBlogGeneration` 폴링 |
| `GET /api/v1/blog/{id}` | `fetchBlogDetail` | `(main)/write-preview/index.tsx` |
| `PUT /api/v1/blog/{id}` | `updateBlog` | `(main)/write-preview/index.tsx` |
| `GET /api/v1/subscriptions/me` | `fetchSubscription` | `settings/subscription/index.tsx`, `settings/theme/index.tsx` |

### 스타일링

NativeWind v4 (Tailwind CSS for React Native)로 전체 스타일링. `StyleSheet.create`는 사용하지 않습니다.

**인라인 `style` prop을 유지해야 하는 경우** (NativeWind 처리 불가):
- `Animated.Value` 기반 값 (translateY, opacity, flex, width 등)
- `boxShadow` 커스텀 문자열
- `contentContainerStyle` (ScrollView)
- `borderLeftColor` 등 동적 색상이 필요한 inline style

**그림자**: RN 0.76+ 기준으로 `shadow*` props 대신 `boxShadow` 사용.
```tsx
style={{boxShadow: '0 1px 4px rgba(0,0,0,0.06)'}}
```

**prop 값** (`placeholderTextColor`, Ionicons `color` 등 className 불가한 곳): `useThemeColors()` 훅 사용 — 현재 테마 색상을 반환하므로 테마 전환에 함께 반응합니다.

### 색상 시스템

색상은 두 레이어로 관리됩니다.

**1. NativeWind 토큰 (`tailwind.config.js`)** — className으로 사용:

모든 색상 토큰은 `var(--color-*)` CSS 변수를 참조합니다. 실제 hex 값은 `constants/themes.ts`의 `THEMES` 프리셋에 정의되어 있으며, `ThemeRoot`에서 루트 View에 `themeVars`로 주입됩니다. `text-muted`만 정적 hex(`#CCCCCC`)로 고정됩니다.

| 클래스 | CSS 변수 | basic 테마 값 | 용도 |
|---|---|---|---|
| `bg-teal-bg` / `text-teal-bg` | `--color-teal-bg` | `#E6F0F1` | 시트·화면 배경 |
| `bg-teal` | `--color-teal` | `#D8E6E8` | 타임라인 바, Journal 탭 |
| `bg-teal-dark` | `--color-teal-dark` | `#A0B4B8` | 드래그 핸들 |
| `bg-teal-accent` | `--color-teal-accent` | `#7BBFD4` | 선택 날짜, 이벤트 dot, 검색 하이라이트 |
| `text-primary` / `bg-primary` | `--color-primary` | `#191F28` | 기본 텍스트, 버튼 배경 |
| `text-medium` | `--color-medium` | `#374151` | 카드 서브 텍스트 |
| `text-secondary` | `--color-secondary` | `#6b7280` | 보조 텍스트 |
| `text-tertiary` | `--color-tertiary` | `#9ca3af` | 힌트·레이블 |
| `bg-surface` | `--color-surface` | `#F6F6F6` | 헤더·푸터·화면 배경 |
| `border-line` | `--color-line` | `#e5e7eb` | 구분선·테두리 |
| `text-muted` | (정적) | `#CCCCCC` | 비활성 텍스트 |

**2. `hooks/useThemeColors.ts`** — prop 값 전용 (placeholderTextColor, icon color 등):
```ts
const tc = useThemeColors();
tc.tertiary     // 현재 테마의 tertiary
tc.tealAccent
```

**테마 시스템** (인프라 완성, UI 토글 미구현):
- `constants/themes.ts`: 4개 테마 프리셋 (basic, dark, strawberry, aqua) — `vars()`로 CSS 변수 값 정의
- `store/themeStore.ts`: `setTheme(id)` 호출로 즉시 전환 가능
- `app/_layout.tsx` ThemeRoot: 루트 View에 `themeVars` style로 주입 → 하위 모든 NativeWind 색상 토큰에 반영
- CSS 변수 레이어는 이미 완성됨 — 남은 작업은 설정 화면에서 `setTheme()` 연결뿐

### 데이터 재조회 정책

캘린더·타임라인 fetch는 `hooks/useCalendar.ts`에 모여 있습니다. **자동 폴링은 하지 않습니다** (배터리·요청량 대비 이득이 적음). 다시 불러오는 시점은 아래가 전부입니다:

| 시점 | 트리거 |
|---|---|
| 월 변경 | `viewDate` 변경 |
| 날짜 선택 | `selectedDate` 변경 |
| 저널 탭 → 홈 탭 | `router.replace`로 홈이 리마운트 |
| 글쓰기·저장 후 홈 복귀 | 위와 동일 |
| **홈에서 홈 탭 재탭** | `timelineStore.requestRefresh()` → `refreshKey` 증가 |
| **앱 백그라운드 → 복귀** | `AppState` `'active'` 리스너 |

**의도적으로 갱신하지 않는 경우**: 홈 화면에 머무는 동안 GPS analyze가 새 장소를 만들어도 화면은 그대로입니다. 확인하려면 홈 탭을 다시 누르면 됩니다.

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
HomeFooter 글쓰기 버튼 → /(main)/write (dailyRecordId 전달)
├── 프롬프트 입력 + 글쓰기 스타일 (정보 위주 / 감성적)
├── POST /api/v1/blog/generate → 202 + blog_id
├── waitForBlogGeneration: GET /api/v1/blogs/{id}/status 폴링 → completed 시 상세 조회
└── /(main)/write-preview (blogId, title, content 전달)
    └── 수정 후 사진 업로드 → PUT /api/v1/blog/{id} → 저장 → 홈 이동

저널 리스트에서 카드 탭 → /(main)/write-preview (blogId만 전달)
└── 해당 화면이 GET /api/v1/blog/{id}로 제목·본문을 채움
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
  - placesCount: number
  - setTimeline(count)           # fetchTimeline 응답 후 호출
  - dailyRecordId: string | null # analyze 응답에서 받아 보관 — 글 생성 요청에 필수
  - setDailyRecordId(id)         # tasks/gpsTask.ts에서 호출
  - refreshKey: number           # 강제 재조회 신호 (useCalendar가 구독)
  - requestRefresh()             # 홈 탭 재탭 시 SectionTabs에서 호출

store/themeStore.ts
  - themeId: ThemeId
  - themeVars: ReturnType<typeof vars>
  - setTheme(id)        # 테마 전환 (인프라 완성, UI 토글 미연결)
```

**핵심 패턴**: `tokenStorage`는 디스크(앱 재시작 후 유지), `authStore`는 메모리 상태(컴포넌트 리렌더 트리거). 로그인·로그아웃 시 반드시 둘 다 업데이트해야 합니다.

### 훅

```
hooks/useBootstrap.ts     # 앱 시작 준비 — 권한 → 토큰 복원 → 진입 화면 결정 (app/index.tsx가 사용)
hooks/usePermissions.ts   # requestAll() — 위치·미디어·카메라 권한 일괄 요청
hooks/useCalendar.ts      # selectedDate, viewDate, calendarDays, places + fetch 로직
hooks/useGpsTracking.ts   # start()/stop() — 위치 추적 시작·중지
hooks/useThemeColors.ts   # 현재 테마의 색상 값 (prop 용)
```

### 유틸 (`utils/formatDate.ts`)

| 함수 | 변환 |
|---|---|
| `toDateKey(date)` | `Date` → `'YYYY-MM-DD'` (기기 로컬 기준) |
| `toKstDateKey(date)` | `Date` → KST 기준 `'YYYY-MM-DD'` — analyze 요청 전용 (백엔드가 날짜 경계를 KST로 해석) |
| `formatDate(date)` | `Date` → `'YY.MM.DD(day)'` |
| `formatDateStr(str)` | `'YYYY-MM-DD'` → `'YY.MM.DD(day)'` |
| `formatTimeFromISO(iso)` | ISO 8601 → `'12:00PM'` |
| `formatTimeAgo(iso)` | ISO 8601 → `'방금'` / `'N분 전'` 등 |

### 경로 별칭

`@/`는 프로젝트 루트를 가리킵니다 (`tsconfig.json` 경로 설정).

## 알려진 문제 / 코드의 구멍

수정하지 않고 남겨둔 것들입니다. 담당 영역이 갈리므로 표의 담당을 확인하세요.

| 문제 | 위치 | 영향 | 담당 |
|---|---|---|---|
| AI 생성 폴링이 37.5초에서 끊김 | `blogApi.ts` `waitForBlogGeneration` (15회 × 2.5초) | 생성이 더 걸리면 실제로는 성공했는데 "글 생성 실패"로 표시됨 | 프론트(글쓰기) |
| `JSON.parse` 방어 없음 | `write-preview/index.tsx` `imageUris` 파싱 | 파라미터가 깨지면 화면 크래시. `useState` 초기값용인데 렌더마다 파싱 | 프론트(글쓰기) |
| 카카오 OAuth URL 하드코딩 | `login.tsx`, `settings/account/index.tsx` | `https://api.roame.com/...` — 실제 도메인 `api.roame.co.kr`와 불일치. 프로덕션 카카오 로그인 실패 가능. 로컬/스테이징 테스트 불가 | 프론트(auth) |
| 실패가 조용히 삼켜짐 | `login.tsx`, `settings/account/index.tsx`의 `console.log` | 카카오 로그인·연동 실패 시 사용자에게 아무 표시 없음 | 프론트(auth) |
| `photoUrls`가 서버에 반영 안 됨 | `write-preview` 저장 | 백엔드 `BlogUpdateRequest`가 `title/content/visibility`만 받음 → 사진이 무시됨. `BlogResponse`에도 `photo_urls` 없어 리스트에서 열면 사진이 비어 보임 | **백엔드** |
| 타임라인 조회 날짜 기준 불일치 | `useCalendar`는 `toDateKey`(기기 로컬), analyze는 `toKstDateKey`(KST) | 기기 타임존이 KST가 아니면 조회 날짜와 분석 날짜가 어긋남. 시뮬레이터 테스트 시 주의 | 프론트 |
| 미사용 변수 | `find-password.tsx:9` `router` | lint 경고 1건 | 프론트(auth) |
| `exhaustive-deps` 경고 2건 | `kakao-login.tsx:42`, `SectionTabs.tsx:41` | 마운트 1회 실행이 의도라 동작은 정상. 의도를 주석으로 명시하면 해소 | 프론트 |

## 미구현 / TODO 항목

| 항목 | 위치 | 비고 |
|---|---|---|
| PostCard 탭 → write-preview 이동 | `PostCard.tsx` | JournalCard와 동일 방식 (`blogId`만 전달) |
| write-preview 저장 후 홈 대신 리스트로 이동 | `write-preview/index.tsx` | |
| 사진 저장 연결 | `write-preview/index.tsx` | 백엔드 `BlogUpdateRequest`에 `photoUrls` 필드 없음 — 현재 무시됨 |
| GPS 시작 호출 중복 | `(auth)/login.tsx`, `hooks/useBootstrap.ts` | 로그인 후 `/`로 이동하면 useBootstrap이 다시 `startGps()` 호출. 로그인 쪽 제거 검토 (리팩토링 C-2) |
| ImagePicker 로직 중복 | `write/index.tsx`, `write-preview/index.tsx` | 거의 동일한 코드 — `useImagePicker` 훅으로 추출 검토 (리팩토링 C-5) |
| 백그라운드 GPS env 정리 | `hooks/useGpsTracking.ts` | `EXPO_PUBLIC_BG_GPS` 개발용 토글이 프로덕션 코드에 상주. `!__DEV__`로 교체 검토 (실기기 테스트 이후) |
| 구독 버튼 → `PUT /api/v1/subscriptions/me` 연결 | `FreeView.tsx`, `SubscriptionModal.tsx` | `{"plan_type": "premium"}` 요청 |
| 구독 해지 모달 | `PremiumView.tsx` | 확인 모달 + API 연결 |
| 회원탈퇴 확인 모달 + API | `settings/account/index.tsx` | |
| GET /api/v1/users/me | `settings/account/index.tsx` | 이메일·카카오 연동 여부 동적 처리 (현재 MOCK) |
| Google Static Maps 실기기 테스트 | `MapPreview.tsx` | `EXPO_PUBLIC_GOOGLE_MAPS_KEY` 사용. URL 생성은 `utils/staticMapUrl.ts` |
| 카카오 OAuth URL 하드코딩 | `login.tsx`, `settings/account/index.tsx` | `https://api.roame.com/...` — 실제 도메인 `api.roame.co.kr`와 불일치. `EXPO_PUBLIC_API_BASE_URL` 기준으로 교체 필요 |
| ScrollView ↔ BottomSheet 제스처 충돌 | `BottomSheet.tsx` | PanResponder 충돌 미해결 |
| 테마 UI 토글 연결 | `settings/theme/index.tsx` | CSS 변수 레이어 완성됨 — `setTheme()` UI 연결 + `bg-primary + text-white` 버튼 색상 설계 필요 |

## 백엔드 팀 확인 필요

 [프론트 → 백엔드 요청/확인 사항]

  ■ 신규 필드 추가 요청
  1. 구독 - 프리미엄 시작일 필드 (premium_started_at)
     - GET /api/v1/subscriptions/me 응답에 추가
     - free→premium 전환 시점 기록, 갱신(재결제) 시에는 유지(리셋 X)
     - 용도: "구독한 지 N일" 표시. 현재 started_at(=created_at)은 가입일이라
  부정확.

  2. 구독 - 결제주기 구분 필드 (billing_cycle: "monthly" | "annual")
     - GET /api/v1/subscriptions/me 응답 + PUT /api/v1/subscriptions/me 요청
  양쪽 반영
     - 용도: 구독 화면 현재 플랜(월/연) 표시. 현재 프론트에서 'monthly' 하드코딩
  중.

  3. 인증 - GET /api/v1/auth/me 에 카카오 연동 여부 추가 (is_kakao_linked:
  boolean)
     - 현재 응답이 {email}만 → 설정>계정의 SNS 연동 상태가 항상 "연동하기"로
  표시됨
     - (계정 연동 기능 보류면 스킵 가능)

  ■ 엔드포인트 확인/정렬
  4. 저널 저장 방식 확정
     - 프론트는 POST /api/v1/blogs 로 저장 예정인데 백엔드에 해당 엔드포인트가
  없음
     - 저장 흐름이 generate(초안 생성) → POST /api/v1/blog/{id}/publish 가
  맞는지 확인 요청

  5. 카카오 계정 연동 딥링크 (source pass-through)
     - 프론트가 GET /auth/kakao/link?source=account-link 로 연동 시도 → 콜백에
  source 그대로 전달 필요
     - 현재 POST /api/v1/auth/kakao (code 교환)만 있어 '계정 연동' 플로우용
  엔드포인트 부재
     - 연동 후 roameapp://kakao-login?...&source=account-link 형태로 리다이렉트
  지원 여부 확인

  ■ 참고 (확인 완료, 조치 불필요)
  - 캘린더 API, GPS 로그(배치 업로드+analyze)는 구현 확인됨
  - blog/generate는 비동기(202+status 폴링) → 프론트에서 폴링 처리 예정

