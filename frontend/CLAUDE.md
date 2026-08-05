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
npm test                  # Jest (jest-expo). tz는 jest.setup.js에서 Asia/Seoul 고정

# iOS 네이티브 모듈 변경 후 필수
cd ios && bundle exec pod install && cd ..
```

## 아키텍처

### 라우팅 구조 (expo-router 파일 기반 라우팅)

```
app/
├── _layout.tsx                      # 루트 레이아웃: 폰트 로드, 스플래시, ThemeRoot
├── index.tsx                        # 진입점: useBootstrap이 정한 곳으로 replace
├── (auth)/
│   ├── login.tsx / signup.tsx
│   ├── find-password.tsx            # 비밀번호 찾기 (이메일 발송)
│   ├── reset-password.tsx           # 비밀번호 재설정 (token 쿼리 파라미터)
│   └── kakao-login.tsx              # 카카오 OAuth 딥링크 콜백
└── (main)/
    ├── (tabs)/
    │   ├── _layout.tsx              # Header + SectionTabs + Slot + Footer
    │   ├── index.tsx                # home으로 redirect
    │   ├── home/index.tsx           # Calendar + BottomSheet
    │   └── journal-list/index.tsx   # 검색 + ScrollView
    ├── write/index.tsx              # 프롬프트 입력 → AI 생성
    ├── write-preview/index.tsx      # 미리보기/저장 (리스트에서 진입 시 상세 조회)
    └── settings/                    # index, account, subscription, theme
```

### 인증 플로우

```
앱 시작 → app/index.tsx → hooks/useBootstrap.ts (준비 작업은 전부 여기에)
    ├── authStore.initialize()          # tokenStorage → authStore 동기화
    ├── 미인증 → /(auth)/login
    └── 인증   → useGpsTracking().start() → 온보딩 여부에 따라 /onboarding 또는 홈

로그인   → authApi.login() → saveTokens() + authStore.setToken()
로그아웃 → authStore.logout() → removeTokens() + clearToken() → /(auth)/login
카카오   → WebBrowser.openAuthSessionAsync() → roameapp://kakao-login?accessToken=...
          → kakao-login.tsx가 저장 후 홈 (source=account-link면 settings/account로 복귀)
```

`tokenStorage`는 디스크(앱 재시작 후 유지), `authStore`는 메모리 상태(리렌더 트리거).
로그인·로그아웃 시 반드시 둘 다 업데이트합니다.

### API 레이어

모든 호출은 `utils/api.ts`의 axios 인스턴스를 통합니다. 기본 타임아웃 15초,
업로드용 `UPLOAD_TIMEOUT_MS`(60초)는 별도 export. 요청 인터셉터가 Bearer 토큰을 붙이고,
응답 인터셉터가 401 시 refresh 후 재시도합니다.

| 엔드포인트 | 함수 | 사용처 |
|---|---|---|
| `POST /api/v1/auth/register` | `signup` | `(auth)/signup.tsx` |
| `POST /api/v1/auth/login` | `login` | `(auth)/login.tsx` |
| `POST /api/v1/auth/refresh` | 인터셉터 자동 처리 | `utils/api.ts` |
| `POST /api/v1/auth/password-reset/request` | `sendResetEmail` | `(auth)/find-password.tsx` |
| `POST /api/v1/auth/password-reset/confirm` | `resetPassword` | `(auth)/reset-password.tsx` |
| `GET /api/v1/auth/me` | `fetchMe` | `settings/account/index.tsx` |
| `GET /api/v1/calendar/{year}/{month}` | `fetchCalendarMonth` | `hooks/useCalendar.ts` |
| `GET /api/v1/calendar/{date}/timeline` | `fetchTimeline` | `hooks/useCalendar.ts` |
| `GET /api/v1/blogs` | `fetchBlogs` | `journal-list/index.tsx` |
| `POST /api/v1/gps/logs` | `uploadGpsLogs` | `tasks/gpsTask.ts` |
| `POST /api/v1/gps/logs/{date}/analyze` | `analyzeGpsLogs` | `tasks/gpsTask.ts` |
| `POST /api/v1/photos/upload` | `uploadPhoto` | `write-preview/index.tsx` |
| `POST /api/v1/blog/generate` | `generateBlog` | `write/index.tsx` |
| `GET /api/v1/blogs/{id}/status` | `fetchBlogGenerationStatus` | `waitForBlogGeneration` 폴링 |
| `GET /api/v1/blog/{id}` | `fetchBlogDetail` | `write-preview/index.tsx` |
| `PUT /api/v1/blog/{id}` | `updateBlog` | `write-preview/index.tsx` |
| `GET /api/v1/subscriptions/me` | `fetchSubscription` | `settings/subscription`, `settings/theme` |

### 스타일링

NativeWind v4로 전체 스타일링. `StyleSheet.create`는 사용하지 않습니다.

인라인 `style` prop을 유지해야 하는 경우: `Animated.Value` 기반 값, `boxShadow` 문자열,
`contentContainerStyle`, `borderLeftColor` 등 동적 색상.

그림자는 RN 0.76+ 기준으로 `shadow*` prop 대신 `boxShadow`를 씁니다.
className을 못 쓰는 prop(`placeholderTextColor`, Ionicons `color` 등)에는
`useThemeColors()` 훅을 씁니다 — 테마 전환에 함께 반응합니다.

### 색상 시스템

색상 토큰은 `var(--color-*)` CSS 변수를 참조합니다. 실제 hex는 `constants/themes.ts`의
`THEMES` 프리셋에 있고, `ThemeRoot`가 루트 View에 `themeVars`로 주입합니다.
`text-muted`만 정적 hex(`#CCCCCC`)입니다.

| 클래스 | basic 값 | 용도 |
|---|---|---|
| `bg-teal-bg` | `#E6F0F1` | 시트·화면 배경 |
| `bg-teal` | `#D8E6E8` | 타임라인 바, Journal 탭 |
| `bg-teal-dark` | `#A0B4B8` | 드래그 핸들 |
| `bg-teal-accent` | `#7BBFD4` | 선택 날짜, 이벤트 dot, 검색 하이라이트 |
| `text-primary` / `bg-primary` | `#191F28` | 기본 텍스트, 버튼 배경 |
| `text-medium` | `#374151` | 카드 서브 텍스트 |
| `text-secondary` | `#6b7280` | 보조 텍스트 |
| `text-tertiary` | `#9ca3af` | 힌트·레이블 |
| `bg-surface` | `#F6F6F6` | 헤더·푸터·화면 배경 |
| `border-line` | `#e5e7eb` | 구분선·테두리 |
| `text-muted` | `#CCCCCC` (정적) | 비활성 텍스트 |

테마는 4개 프리셋(basic, dark, strawberry, aqua)이 있고 `themeStore.setTheme(id)`로 전환합니다.

### 권한 정책

권한 관련 로직은 전부 `hooks/usePermissions.ts`에 있고, 문구는 `constants/permissionMessages.ts`에 있습니다.
화면은 함수를 호출만 합니다.

| 함수 | 호출부 | 시점 |
|---|---|---|
| `useLocationPermissionGuard()` | `app/(main)/_layout.tsx` | 앱 진입 + `AppState` `'active'` 복귀마다 |
| `ensureMediaLibraryPermission()` | `write`, `write-preview`의 사진 버튼 | 사진 첨부 직전 |

- **요청 시점**: 앱 진입 직후가 아니라 `(main)` 진입 시. 온보딩은 `(main)` 바깥이라
  신규 사용자는 자동으로 "온보딩 완료 후" 요청을 받습니다.
- **카메라 권한은 요청하지 않습니다** — `launchImageLibraryAsync`만 쓰고 카메라는 호출하지 않습니다.
- **거부 시**: 아직 물어볼 수 있으면(`canAskAgain`) 시스템 다이얼로그, 이미 거부됐으면
  불이익 + 설정 경로를 담은 `Alert` → `Linking.openSettings()`.
- 설정에서 뒤늦게 허용하면 `AppState` 복귀 시 감지해 `startGpsTracking()`이 살아납니다.
- `isAlertOpen` / `isCheckingLocation` 모듈 플래그로 안내가 겹쳐 쌓이는 것을 막습니다.

### 데이터 재조회 정책

캘린더·타임라인 fetch는 `hooks/useCalendar.ts`에 모여 있습니다. **자동 폴링은 하지 않습니다.**
다시 불러오는 시점: 월 변경, 날짜 선택, 저널 탭→홈 탭(리마운트), 글쓰기 후 홈 복귀,
홈에서 홈 탭 재탭(`timelineStore.requestRefresh()`), 앱 백그라운드→복귀(`AppState`).

홈 화면에 머무는 동안 GPS analyze가 새 장소를 만들어도 화면은 그대로입니다 — 홈 탭을 다시 누르면 반영됩니다.

### BottomSheet

PanResponder로 3단계 스냅: `0`(expanded), `sheetHeight - peekHeight`(peek),
`sheetHeight - 30`(handleOnly). translateY가 `sheetHeight * 0.45` 미만이면
MapPreview가 페이드인됩니다(`isMapMounted` + `mapOpacity`).

### 글쓰기 플로우

```
HomeFooter 글쓰기 버튼 → /(main)/write (dailyRecordId 전달)
├── 프롬프트 + 스타일(정보 위주 / 감성적) → POST /blog/generate (202 + blog_id)
├── waitForBlogGeneration: status 폴링 → completed 시 상세 조회
└── /(main)/write-preview → 사진 업로드 → PUT /blog/{id} → 홈

저널 리스트 카드 탭 → /(main)/write-preview (blogId만) → 해당 화면이 상세 조회
```

### 상태 관리 (Zustand)

```
store/authStore.ts      accessToken, isAuthenticated / setToken, clearToken, initialize, logout
store/timelineStore.ts  placesCount, dailyRecordId(글 생성에 필수), refreshKey / requestRefresh
store/themeStore.ts     themeId, themeVars / setTheme, initialize
```

### 훅

```
hooks/useBootstrap.ts     앱 시작 준비 — 토큰 복원 → 진입 화면 결정
hooks/usePermissions.ts   권한 확인·요청·거부 안내 (아래 "권한 정책" 참고)
hooks/useCalendar.ts      selectedDate, viewDate, calendarDays, places + fetch
hooks/useGpsTracking.ts   start() / stop()
hooks/useThemeColors.ts   현재 테마 색상 값 (prop 용)
```

### 유틸 (`utils/formatDate.ts`)

| 함수 | 변환 |
|---|---|
| `toDateKey(date)` | `Date` → 기기 로컬 `'YYYY-MM-DD'` — **현재 미사용** (아래 정책 참고) |
| `toKstDateKey(date)` | `Date` → KST `'YYYY-MM-DD'` — 서버로 보내는 날짜 키는 전부 이것 |
| `formatDate(date)` | `Date` → `'YY.MM.DD(day)'` |
| `formatDateStr(str)` | `'YYYY-MM-DD'` → `'YY.MM.DD(day)'` |
| `formatTimeFromISO(iso)` | ISO 8601 → `'12:00PM'` |
| `formatTimeAgo(iso)` | ISO 8601 → `'방금'` / `'N분 전'` 등 |

### 경로 별칭

`@/`는 프로젝트 루트를 가리킵니다.

## 테스트

`jest-expo` 프리셋. 화면 렌더링은 테스트하지 않고 **순수 로직만** 다룹니다.

```bash
npm test              # 전체
npm run test:watch    # 변경 감지
npx jest gpsTask      # 파일 하나
```

| 파일 | 대상 | 핵심 |
|---|---|---|
| `__tests__/formatDate.test.ts` | `utils/formatDate.ts` | KST 자정 경계(`15:00Z`), 월·연 넘김, 12AM/PM, `formatTimeAgo` 임계값 |
| `__tests__/gpsTask.test.ts` | `tasks/gpsTask.ts` | 자정 걸친 배치가 두 날짜 모두 analyze되는지, 한 날짜 실패 시 나머지 진행, 업로드 실패 시 analyze 미호출 |
| `__tests__/blogApi.test.ts` | `waitForBlogGeneration` | completed/failed 분기, **15회(37.5초) 타임아웃 상한** |
| `__tests__/staticMapUrl.test.ts` | `utils/staticMapUrl.ts` | 키 없으면 null, 장소 0/1/N개별 center·zoom, 미리보기와 저장본이 같은 시야 |
| `__tests__/authStore.test.ts` | `authStore` + `tokenStorage` + `onboardingStorage` | 디스크·메모리 동시 갱신(로그아웃), `initialize` 복원 |

`jest.setup.js`가 두 가지를 합니다:

- **`process.env.TZ = 'Asia/Seoul'` 고정** — `formatDate`·`formatTimeFromISO`가 기기 로컬 시간에
  의존해서, tz를 안 박으면 CI(UTC)에서 그냥 깨집니다. 반대로 **해외 지원 작업에 들어갈 때
  이 값을 `America/New_York` 등으로 바꿔 돌리면 어디가 깨지는지 바로 나옵니다.**
- AsyncStorage를 인메모리 목으로 교체 (네이티브 모듈이라 JS 환경에 없음)

새 테스트를 쓸 때: 네이티브 모듈에 의존하는 모듈은 `jest.mock`으로 잘라내고
(`expo-task-manager`는 `defineTask`에 등록된 핸들러를 붙잡아 직접 호출),
`EXPO_PUBLIC_*`를 import 시점에 읽는 모듈은 `jest.isolateModules`로 다시 로드합니다.

## 시간·타임존 정책

**방향 확정: 해외 지원 (기기 로컬 기준).** 저장은 UTC 그대로 두고, 날짜 계산 시 앱이 tz를 파라미터로 보냅니다.

원칙은 두 값을 섞지 않는 것입니다.

- **순간(instant)** — 언제 일어났나: 전부 UTC (`timestamptz`, GPS `timestamp`는 ISO 8601 UTC)
- **달력 날짜(civil date)** — 며칠의 기록인가: 그 기록이 속한 tz가 필요

### 현재 상태 (KST 고정 단계)

날짜 키는 `toKstDateKey`로 KST, 화면 표시는 기기 로컬. 백엔드도 KST로 통일돼 있어
**국내에서는 앞뒤가 맞습니다.** 해외 기기에서만 어긋납니다.

### 기기 tz로 넘어갈 때

| 대상 | 변경 |
|---|---|
| `daily_records` | `timezone` 컬럼 추가 (IANA 문자열) — **선행 조건** |
| GPS 업로드 | 배치에 `timezone` 동봉 |
| analyze | 클라가 tz 전달 → 백엔드가 그 tz로 하루 경계 계산 |
| 타임라인 응답 | `utc_offset_minutes` 동봉 |
| `formatTimeFromISO` | 저장된 오프셋으로 포맷 (기록 당시 현지 시각 고정 표시) |
| `toKstDateKey` | 기기 tz 기준으로 교체 |
| 캘린더 "오늘" | 그대로 — 지금 여기 기준이 맞음 |

기기 tz는 `Intl.DateTimeFormat().resolvedOptions().timeZone`. 실기기에서 값 확인 필요하고,
안 되면 `expo-localization` 추가.

### 미결

1. 다른 날에 쓴 글의 날짜 — 작성일 / 기록 대상일 (`write/index.tsx:43`이 항상 오늘로 표시 중)
2. 자정 걸친 활동 — `MIN_STAY_MINUTES = 3`이라 쪼개진 조각이 양쪽 다 통과해 **중복 계상**됨
3. "하루"의 경계 시각 — 자정 / 새벽 4~5시 (2의 실질적 해법)
4. EXIF `OffsetTimeOriginal` 우선 사용 여부 — 해외에서 찍은 사진은 KST 고정이면 다시 어긋남

## 알려진 문제

| 문제 | 위치 | 영향 | 담당 |
|---|---|---|---|
| 기존 사진의 `taken_at`이 9시간 밀린 채 저장돼 있음 | `photos` 테이블 | EXIF 파서는 고쳐졌지만 저장된 행은 그대로. EXIF 유래 행과 `now()` 폴백 행이 섞여 있어 일괄 `-9h` 불가 | 백엔드 |
| `daily_records.timezone` 컬럼 없음 | `backend/app/models/daily_record.py` | 해외 지원(기기 tz)의 전제. 나중에 넣으면 과거 기록의 tz를 알 수 없음 | 백엔드 |
| 날짜 비교가 인덱스를 못 탐 | `calendar.py:89`, `ai.py:111,143` | `func.date(func.timezone(...))`로 컬럼을 감쌈. 같은 파일 `ai.py:40-57`은 범위 비교라 방식이 섞여 있음 | 백엔드 |
| EXIF 없는 사진이 업로드 시각으로 저장 | `backend/app/services/photos.py:42` | 몰아서 올리면 엉뚱한 장소에 붙음 | 백엔드 |
| `photoUrls`가 서버에 반영 안 됨 | 프론트는 완료 | `BlogUpdateRequest`가 `title/content/visibility`만 받고 `BlogResponse`에 `photo_urls` 없음 | 백엔드 |
| 자정 걸친 체류가 중복 계상 | `ai/server/modules/gps.py` | `place_count`가 부풀려짐 | 회의 안건 3·4 |
| 지도 공유 기능 비활성 | `MapPreview.tsx` | `RNFetchBlob`이 네이티브 전용이라 Expo 웹 번들이 깨져 주석 처리됨. 되살리려면 `Platform.OS` 가드 필요 | 프론트 |
| AI 생성 폴링이 37.5초에서 끊김 | `blogApi.ts` `waitForBlogGeneration` | 실제로는 성공했는데 "생성 실패"로 표시 | 프론트(글쓰기) |
| `JSON.parse` 방어 없음 | `write-preview/index.tsx:30` | 파라미터가 깨지면 크래시. 렌더마다 파싱 | 프론트(글쓰기) |

## 미구현 / TODO

| 항목 | 위치 | 비고 |
|---|---|---|
| PostCard 탭 동작 미정 | `PostCard.tsx` | `TimelinePlace`에 `blogId`가 없어 저널로 못 보냄. 사진 뷰어 / 장소 상세 / 장소명 수정 중 기획 결정 필요. 그때까지 `View` |
| 저장 후 리스트로 이동 | `write-preview/index.tsx` | 현재는 홈으로 |
| 백그라운드 GPS env 정리 | `hooks/useGpsTracking.ts` | `EXPO_PUBLIC_BG_GPS` 개발용 토글 → `!__DEV__` 검토 |
| MapPreview 공유 실기기 테스트 | `MapPreview.tsx:52-70` | 시뮬레이터는 공유 시트에 앱이 없어 검증 불가 |
| `is_kakao_linked` 미연동 | `settings/account/index.tsx` | 프론트 타입은 준비됨. 백엔드 `/auth/me`가 아직 `email`만 반환 |
| GPS 시작 호출 중복 (낮음) | `(auth)/login.tsx:47`, `useBootstrap.ts` | 가드가 있어 무해. 가독성 정리 |

## 백엔드 팀 확인 필요

**시간** — EXIF·polyline·photo_count의 KST 통일과 `app/utils/timezone.py` 공용화는 완료됨. 남은 것:
- 기존 `photos.taken_at` 보정 (테스트 데이터뿐이면 테이블을 비우는 편이 깨끗)
- `daily_records.timezone` 컬럼 추가 + 기존 행 `'Asia/Seoul'` 백필 → **해외 지원의 전제**
- 날짜 비교를 반개구간으로 통일 (인덱스 사용. `ai.py`의 `23:59:59` 경계 누락도 함께 해소)
- 해외 지원 시 tz 파라미터는 오프셋 숫자가 아닌 **IANA 문자열**(`Asia/Seoul`) — 서머타임 대응
- EXIF `OffsetTimeOriginal`이 있으면 우선 사용 (없을 때만 그날의 tz 폴백)
- Postgres `TimeZone` 확인 — compose에 `TZ` 미설정이라 UTC로 가정 중

**신규 필드**
1. `GET /subscriptions/me`에 `premium_started_at` — 갱신 시 리셋 X. "구독한 지 N일" 표시용
2. `billing_cycle: "monthly" | "annual"` — GET 응답 + PUT 요청 양쪽. 현재 프론트에서 하드코딩
3. `GET /auth/me`에 `is_kakao_linked` — 현재 `{email}`만 반환

**엔드포인트 확인**
4. 저널 저장 방식 — 프론트는 `POST /api/v1/blogs`를 상정했으나 해당 엔드포인트 없음.
   `generate` → `POST /blog/{id}/publish`가 맞는지 확인
5. 카카오 계정 연동 딥링크 — `source=account-link` pass-through 지원 여부
