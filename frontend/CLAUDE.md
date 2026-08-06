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
    └── 인증   → 온보딩 여부에 따라 /onboarding 또는 홈

로그인   → authApi.login() → saveTokens() + authStore.setAuthenticated()
로그아웃 → authStore.logout() → removeTokens() + isAuthenticated=false
          → (main)/_layout이 stopGpsTracking() 후 /(auth)/login
카카오   → WebBrowser.openAuthSessionAsync() → roameapp://kakao-login?accessToken=...
          → kakao-login.tsx가 저장 후 홈 (source=account-link면 settings/account로 복귀)
```

**토큰 값의 단일 출처는 `tokenStorage`(디스크)입니다.** `authStore`는 `isAuthenticated`
불리언만 들고 있고, 화면 가드(`(main)/_layout.tsx`)를 리렌더시키는 용도입니다.
API 요청 시 토큰은 인터셉터가 `tokenStorage`에서 직접 꺼내므로, store에 토큰을 복제하면
401 재발급 때마다 두 곳이 어긋납니다 — 그래서 두지 않습니다.

### API 레이어

모든 호출은 `utils/api.ts`의 axios 인스턴스를 통합니다. 기본 타임아웃 15초,
요청 인터셉터가 Bearer 토큰을 붙이고,
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
| `GET /api/v1/blogs` | `fetchBlogs` | `hooks/useJournalList.ts` (`q`·`page`·`size` 사용) |
| `POST /api/v1/gps/logs` | `uploadGpsLogs` | `tasks/gpsTask.ts` (body에 `timezone` 동봉) |
| `POST /api/v1/gps/logs/{date}/analyze` | `analyzeGpsLogs` | `tasks/gpsTask.ts` (`?timezone=`) |
| `POST /api/v1/blog/generate` | `generateBlog` | `write/index.tsx` |
| `GET /api/v1/blogs/{id}/status` | `fetchBlogGenerationStatus` | `waitForBlogGeneration` 폴링 |
| `GET /api/v1/blog/{id}` | `fetchBlogDetail` | `write-preview/index.tsx` |
| `PUT /api/v1/blog/{id}` | `updateBlog` | `write-preview/index.tsx` |
| `GET /api/v1/subscriptions/me` | `fetchSubscription` | `settings/subscription`, `settings/theme` |
| `PUT /api/v1/subscriptions/me` | `subscribePremium`, `cancelSubscription` | `settings/subscription` |

| `POST /api/v1/photos/upload` | `uploadPhoto` | `utils/photoSync.ts` (타임라인 카드 사진) |

백엔드에는 있으나 **프론트가 아직 안 쓰는** 엔드포인트:
`POST /api/v1/subscriptions/verify`(인앱결제 영수증 검증),
`POST /api/v1/blog/{id}/publish`(발행 — 공개 기능이 생기면 붙일 자리).

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
| `ensurePhotoLibraryPermission()` | `usePermissions` 내부 | 위치 권한을 다 받은 **직후** (타임라인 사진 자동 동기화용) |

- **요청 시점**: 앱 진입 직후가 아니라 `(main)` 진입 시. 온보딩은 `(main)` 바깥이라
  신규 사용자는 자동으로 "온보딩 완료 후" 요청을 받습니다.
- **카메라 권한은 요청하지 않습니다** — `launchImageLibraryAsync`만 쓰고 카메라는 호출하지 않습니다.
- **거부 시**: 아직 물어볼 수 있으면(`canAskAgain`) 시스템 다이얼로그, 이미 거부됐으면
  불이익 + 설정 경로를 담은 `Alert` → `Linking.openSettings()`.
- 설정에서 뒤늦게 허용하면 `AppState` 복귀 시 감지해 `startGpsTracking()`이 살아납니다.
- **GPS 시작은 여기 한 곳뿐입니다.** 로그인 화면이나 `useBootstrap`에서 부르면 권한 요청
  전이라 항상 조용히 실패하므로 두지 않습니다. 정지는 `(main)/_layout`이 미인증을 감지할 때.
- `isAlertOpen` / `isCheckingLocation` 모듈 플래그로 안내가 겹쳐 쌓이는 것을 막습니다.

### 데이터 재조회 정책

캘린더·타임라인 fetch는 `hooks/useCalendar.ts`에 모여 있습니다. **자동 폴링은 하지 않습니다.**
다시 불러오는 시점: 월 변경, 날짜 선택, 저널 탭→홈 탭(리마운트), 글쓰기 후 홈 복귀,
홈에서 홈 탭 재탭(`timelineStore.requestRefresh()`), 앱 백그라운드→복귀(`AppState`).

홈 화면에 머무는 동안 GPS analyze가 새 장소를 만들어도 화면은 그대로입니다 — 홈 탭을 다시 누르면 반영됩니다.

**analyze 호출 시점**(`utils/analyzeSchedule.ts`): GPS 배치마다가 아니라 **1시간 주기 + 논리 날짜가
넘어갔을 때 전날 확정 + 앱 진입·포그라운드 복귀(1분 가드)**. `lastAnalyzedDate`는 성공했을 때만
갱신해 실패한 날짜가 다음 주기에 자동 재시도됩니다.

### 구독 상태

서버가 단일 출처입니다. `subscriptionStore`가 들고 있고, **프리미엄 기능 개방 판정은
`isPremium()` 하나만 봅니다** (`plan === 'premium' && isActive && 만료 전).

| 규칙 | 이유 |
|---|---|
| `plan`을 프론트가 직접 정하지 않는다 | 낙관적 업데이트를 하면 결제 검증 실패 시 유료 기능이 잠깐 열립니다. 진행 표시가 필요하면 `plan` 대신 별도 로딩 플래그를 쓰세요. **eslint(`no-restricted-syntax`)가 화면에서의 `setState` 호출을, TS `readonly`가 필드 대입을 막습니다** |
| 조회 실패 시 `free`로 떨어뜨린다 | 모를 때 프리미엄으로 두면 조회 실패가 곧 유료 기능 개방이 됩니다 |
| 프리미엄이 끊기면 프리미엄 테마를 `basic`으로 되돌린다 | `refresh()`가 처리합니다. 대상은 `constants/themes.ts`의 `PREMIUM_THEMES` |
| `expires_at`이 지났으면 서버가 `active`라 해도 만료로 본다 | 앱을 오래 켜둔 채 만료가 지나는 경우 |

재조회 시점은 `useSubscriptionSync`(앱 진입 + `AppState` 복귀)와 결제·해지 직후입니다.
인앱결제는 시스템 다이얼로그라 앱 밖에서 완료될 수 있어 복귀 갱신이 특히 중요합니다.
로그아웃 시 `(main)/_layout`이 `reset()`으로 비웁니다 — 다음 계정이 물려받으면 안 됩니다.

> ⚠️ 지금 프리미엄 판정은 **클라이언트에만** 있습니다. 테마는 겉모습이라 괜찮지만,
> BM의 **횟수 제한처럼 비용이 드는 기능은 반드시 서버가 막아야 합니다.**
> 프론트의 `isPremium()`은 UI 표시용이지 보안 경계가 아닙니다.

### BottomSheet

PanResponder로 3단계 스냅: `0`(expanded), `sheetHeight - peekHeight`(peek),
`sheetHeight - 30`(handleOnly). translateY가 `sheetHeight * 0.45` 미만이면
MapPreview가 페이드인됩니다(`isMapMounted` + `mapOpacity`).

### 글쓰기 플로우

```
HomeFooter 글쓰기 버튼 → /(main)/write (dailyRecordId 전달)
├── 프롬프트 + 스타일(정보 위주 / 감성적) → POST /blog/generate (202 + blog_id)
├── waitForBlogGeneration: status 폴링 → completed 시 상세 조회
└── /(main)/write-preview → PUT /blog/{id} → 저널 리스트

저널 리스트 카드 탭 → /(main)/write-preview (blogId만) → 해당 화면이 상세 조회
```

**포스팅에 사진은 넣지 않기로 했습니다** (회의 결정). `write`·`write-preview`의 사진 첨부
UI와 `blogApi.ts`의 `uploadPhoto`·`photoUrls`도 제거했습니다.
`usePermissions.ts`의 `ensureMediaLibraryPermission`만 '사진 모아보기'용으로 남겨뒀습니다.
GPS 분석용 사진(`photos` 테이블, EXIF 기반 장소 매칭)은 이 결정과 무관하게 그대로입니다.

### 상태 관리 (Zustand)

```
store/authStore.ts      isAuthenticated / setAuthenticated, clearAuth, initialize, logout
store/timelineStore.ts  placesCount, dailyRecordId(글 생성에 필수), refreshKey / requestRefresh
store/themeStore.ts     themeId, themeVars / setTheme, initialize
store/subscriptionStore.ts  plan, isActive, expiresAt, willRenew, hasLoaded
                        / isPremium(), refresh, refreshUntilChanged, reset
store/settingsStore.ts  isTrackingEnabled, hasLoaded / initialize, setTrackingEnabled
                        위치 기록 토글. 기본 켬, AsyncStorage 저장.
                        끄면 stopGpsTracking(), 켜면 startGpsTracking()
```

### 훅

```
hooks/useBootstrap.ts     앱 시작 준비 — 토큰 복원 → 진입 화면 결정
hooks/usePermissions.ts   권한 확인·요청·거부 안내 (아래 "권한 정책" 참고)
hooks/useCalendar.ts      selectedDate, viewDate, calendarDays, places + fetch
hooks/useGpsTracking.ts   start() / stop()
hooks/useThemeColors.ts   현재 테마 색상 값 (prop 용)
hooks/useSubscriptionSync.ts  구독 재조회 시점 (앱 진입 + AppState 복귀)
hooks/useJournalList.ts   저널 목록 — 서버 검색(디바운스) + 페이지네이션
hooks/useDailyAnalyze.ts  앱 진입·복귀 시 오늘 analyze → 성공 시 requestRefresh()
hooks/usePhotoSync.ts     앱 진입·복귀 시 오늘 사진 자동 업로드 (과거는 useCalendar가 고른 날짜만)
utils/timezone.ts         getDeviceTimeZone() — 서버로 보낼 IANA tz
utils/analyzeSchedule.ts  analyze 호출 시점 (위 "데이터 재조회 정책" 참고)
utils/photoSync.ts        그 날짜 사진 스캔 → 안 올린 것만 업로드
                          (날짜별 5분 간격, 와이파이일 때만, 스크린샷 제외, 회당 20장)
```

### 유틸 (`utils/formatDate.ts`)

| 함수 | 변환 |
|---|---|
| `toDateKey(date)` | **달력 날짜** → `'YYYY-MM-DD'`. 경계 보정 안 함 (캘린더에서 고른 날짜용) |
| `toLogicalDateKey(date)` | **순간** → 그 순간이 속한 논리적 하루. 새벽 4시 이전은 전날 (GPS timestamp용) |
| `logicalToday()` | 지금이 속한 논리적 하루의 로컬 자정 `Date` (캘린더 "오늘") |
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
| `__tests__/formatDate.test.ts` | `utils/formatDate.ts` | 새벽 4시 경계, 달력 날짜와 순간의 구분, 12AM/PM, `formatTimeAgo` 임계값 |
| `__tests__/timezone.test.ts` | `utils/timezone.ts` | expo-localization → Intl → Asia/Seoul 폴백, `UTC` 오탐 처리 |
| `__tests__/kakao.test.ts` | `constants/kakao.ts` | base URL 끝 슬래시 제거(카카오는 redirect_uri를 문자 단위로 비교), 앱 딥링크와 백엔드 콜백 구분 |
| `__tests__/photoSync.test.ts` | `utils/photoSync.ts` | 논리적 하루 범위, 스크린샷 제외, ph:// → localUri, 중복 방지, 실패 시 재시도, 와이파이 게이트, 날짜별 간격 가드, 로그아웃 시 기록 삭제 |
| `__tests__/gpsTask.test.ts` | `tasks/gpsTask.ts` | 좌표 변환, 업로드 실패 시 분석으로 안 넘어감, 분석은 스케줄러에 위임 |
| `__tests__/analyzeSchedule.test.ts` | `utils/analyzeSchedule.ts` | 1시간 주기 가드, 날짜 넘어감 감지, 실패 시 기준 날짜 미갱신(재시도), 백그라운드·포그라운드가 시각 공유 |
| `__tests__/blogApi.test.ts` | `waitForBlogGeneration` | completed/failed 분기, **15회(37.5초) 타임아웃 상한** |
| `__tests__/staticMapUrl.test.ts` | `utils/staticMapUrl.ts` | 키 없으면 null, 장소 0/1/N개별 center·zoom, 미리보기와 저장본이 같은 시야 |
| `__tests__/authStore.test.ts` | `authStore` + `tokenStorage` + `onboardingStorage` | 토큰을 store에 복제하지 않음, `clearAuth`와 `logout`의 차이, `initialize` 복원 |
| `__tests__/subscriptionStore.test.ts` | `subscriptionStore` | 조회 실패 시 free 강등, 만료 판정, 프리미엄 테마 basic 복귀, 해지 예약(`willRenew`)은 판정에 넣지 않음, 결제 후 재조회 재시도 |
| `__tests__/settingsStore.test.ts` | `settingsStore` | 기본값 켬, 복원, 켜고 끌 때 GPS 시작·정지, 같은 값이면 무동작, 저장 실패 시 세션 반영 |
| `__tests__/useJournalList.test.ts` | `useJournalList` | 디바운스, 늦게 온 응답 무시, 페이지 이어붙이기, 실패 시 기존 목록 유지 |

`jest.setup.js`가 두 가지를 합니다:

- **`process.env.TZ = 'Asia/Seoul'` 고정** — `formatDate`·`formatTimeFromISO`가 기기 로컬 시간에
  의존해서, tz를 안 박으면 CI(UTC)에서 그냥 깨집니다. 반대로 **해외 지원 작업에 들어갈 때
  이 값을 `America/New_York` 등으로 바꿔 돌리면 어디가 깨지는지 바로 나옵니다.**
- AsyncStorage를 인메모리 목으로 교체 (네이티브 모듈이라 JS 환경에 없음)

새 테스트를 쓸 때: 네이티브 모듈에 의존하는 모듈은 `jest.mock`으로 잘라내고
(`expo-task-manager`는 `defineTask`에 등록된 핸들러를 붙잡아 직접 호출),
`EXPO_PUBLIC_*`를 import 시점에 읽는 모듈은 `jest.isolateModules`로 다시 로드합니다.

## 시간·타임존 정책

원칙은 두 값을 섞지 않는 것입니다.

- **순간(instant)** — 언제 일어났나: 전부 UTC (`timestamptz`, GPS `timestamp`는 ISO 8601 UTC)
- **달력 날짜(civil date)** — 며칠의 기록인가: tz와 하루 경계가 필요

### 하루의 경계는 기기 로컬 새벽 4시

자정이 아닙니다. **논리 날짜 = (기기 로컬 시각 − 4시간)의 달력 날짜.**

```
로컬 8/5 23:00  → 2026-08-05
로컬 8/6 03:59  → 2026-08-05   ← 자정을 넘겨도 아직 전날
로컬 8/6 04:00  → 2026-08-06
```

자정을 걸친 체류가 이틀로 쪼개져 `place_count`가 중복 계상되던 문제도 이걸로 해소됩니다.

**표시용 날짜는 보정하지 않습니다.** `formatDate`는 실제 달력 날짜 그대로입니다.
경계 보정은 **데이터 키에만** 적용합니다.

### 두 함수를 헷갈리면 하루가 밀립니다

| 입력 | 함수 | 예 |
|---|---|---|
| 실제 시각(순간) | `toLogicalDateKey` | GPS 로그 timestamp, 지금 |
| 이미 정해진 달력 날짜 | `toDateKey` | 캘린더에서 고른 날짜 |

캘린더가 주는 값은 그 날짜의 **로컬 자정**입니다. 여기에 `toLogicalDateKey`를 쓰면
4시간이 빠져 **하루 전으로 밀립니다.** 사용자가 5일을 골랐으면 그냥 5일입니다.

### 타임존

기기 로컬 기준입니다. 날짜 계산에 `Intl`의 `timeZone` 옵션을 쓰지 않습니다 —
`Date`의 로컬 게터만으로 충분하고, Hermes의 `Intl` 구현에 기대지 않는 편이 안전합니다.

서버가 같은 계산을 할 수 있도록 tz 문자열을 함께 보냅니다:

| 대상 | 방식 |
|---|---|
| GPS 업로드 | body에 `timezone` 동봉 |
| analyze | 쿼리 파라미터 `?timezone=` |

`getDeviceTimeZone()`(`utils/timezone.ts`)은 **expo-localization → `Intl` → `Asia/Seoul`**
순으로 폴백합니다. Hermes 빌드에 따라 `Intl`이 `UTC`를 뱉는 사례가 있어서입니다.
**오프셋 숫자가 아닌 IANA 문자열**(`Asia/Seoul`)을 씁니다 — 오프셋은 서머타임 지역에서
계절마다 달라져 과거 기록의 경계를 다시 계산할 수 없습니다.

> 백엔드는 아직 tz도 4시 경계도 반영 전입니다. 지금 보내는 값은 조용히 무시되고
> (pydantic `extra='ignore'`, FastAPI의 미지 쿼리 무시), 백엔드가 받기 시작하면
> **앱 재배포 없이 켜집니다.** 그때까지 새벽 0~4시에는 프론트가 계산한 날짜와
> 백엔드가 저장한 날짜가 달라 그 시간대 타임라인이 비어 보일 수 있습니다.

### 남은 미결

1. 4시 경계를 **표시**에도 적용할지 — 새벽 3시 기록을 `3:00AM`으로 볼지 `27:00`으로 볼지
2. 여행 중 tz가 바뀌는 날 — `daily_records.timezone`이 한 칼럼이면 하루에 tz가 하나뿐이라
   비행기 탄 날이 어긋난다. 출발지 / 도착지 / 로그별 중 택일 **(컬럼 추가 전에 결정 필요)**
3. 구독 횟수 제한의 리셋 시점 — 4시 경계를 따르는지, 월 N회면 월 경계는 어느 tz 기준인지
4. EXIF `OffsetTimeOriginal` 우선 사용 여부 — 해외에서 찍은 사진은 KST 고정이면 다시 어긋남

## 알려진 문제

| 문제 | 위치 | 영향 | 담당 |
|---|---|---|---|
| 기존 사진의 `taken_at`이 9시간 밀린 채 저장돼 있음 | `photos` 테이블 | EXIF 파서는 고쳐졌지만 저장된 행은 그대로. EXIF 유래 행과 `now()` 폴백 행이 섞여 있어 일괄 `-9h` 불가 | 백엔드 |
| `daily_records.timezone` 컬럼 없음 | `backend/app/models/daily_record.py` | 해외 지원(기기 tz)의 전제. 나중에 넣으면 과거 기록의 tz를 알 수 없음 | 백엔드 |
| 날짜 비교가 인덱스를 못 탐 | `calendar.py:89`, `ai.py:111,143` | `func.date(func.timezone(...))`로 컬럼을 감쌈. 같은 파일 `ai.py:40-57`은 범위 비교라 방식이 섞여 있음 | 백엔드 |
| EXIF 없는 사진이 업로드 시각으로 저장 | `backend/app/services/photos.py:42` | 몰아서 올리면 엉뚱한 장소에 붙음 | 백엔드 |
| 카카오 계정 연동이 404 | `settings/account/index.tsx` | 백엔드에 `/auth/kakao/link` 엔드포인트가 **없음**. 버튼을 누르면 실패한다 | 백엔드 |
| 카카오 로그인이 서버 env·콘솔 설정에 걸려 있음 | 서버 `KAKAO_REDIRECT_URI`, 카카오 개발자 콘솔 | 프론트는 `https://api.roame.co.kr/api/v1/auth/kakao/callback`을 보낸다. **셋(프론트·서버 env·콘솔 등록값)이 문자 단위로 같아야** 하고, 하나라도 다르면 KOE006으로 막힌다 | 백엔드 |
| 자정 걸친 체류가 중복 계상 | `ai/server/modules/gps.py` | `place_count`가 부풀려짐 | 회의 안건 3·4 |
| 지도 공유 기능 비활성 | `MapPreview.tsx` | `RNFetchBlob`이 네이티브 전용이라 Expo 웹 번들이 깨져 주석 처리됨. 되살리려면 `Platform.OS` 가드 필요 | 프론트 |
| AI 생성 폴링이 37.5초에서 끊김 | `blogApi.ts` `waitForBlogGeneration` | 실제로는 성공했는데 "생성 실패"로 표시 | 프론트(글쓰기) |
| `JSON.parse` 방어 없음 | `write-preview/index.tsx:30` | 파라미터가 깨지면 크래시. 렌더마다 파싱 | 프론트(글쓰기) |

## 미구현 / TODO

| 항목 | 위치 | 비고 |
|---|---|---|
| PostCard 탭 동작 미정 | `PostCard.tsx` | `TimelinePlace`에 `blogId`가 없어 저널로 못 보냄. 사진 뷰어 / 장소 상세 / 장소명 수정 중 기획 결정 필요. 그때까지 `View` |
| 백그라운드 GPS env 정리 | `hooks/useGpsTracking.ts` | `EXPO_PUBLIC_BG_GPS` 개발용 토글 → `!__DEV__` 검토 |
| 인앱결제 | `settings/subscription` | 백엔드 `POST /subscriptions/verify` 준비됨. mock 영수증 형식 `mock:<txid>:<monthly\|annual>` |
| `billing_cycle` 미사용 | `services/subscriptionApi.ts` | 백엔드가 GET 응답·PUT 요청 양쪽 지원하는데 프론트가 안 보냄 (월/연 선택 UI 없음) |
| `premium_started_at` 미사용 | `services/subscriptionApi.ts` | 백엔드 응답에 있음. "구독한 지 N일" 표시에 쓸 수 있음 |
| 구독 만료 시 안내 없음 | `subscriptionStore` | 테마는 basic으로 되돌리지만 사용자에게 알리지 않음 |
| `is_kakao_linked` 미연동 | `settings/account/index.tsx` | 프론트 타입은 준비됨. 백엔드 `/auth/me`가 아직 `email`만 반환 |

## 백엔드 팀 확인 필요

**시간** — 프론트는 기기 tz + 새벽 4시 경계로 전환 완료. 백엔드는 아직 KST 고정 + 자정 기준이라
**새벽 0~4시에 양쪽 계산이 어긋납니다.** 필요한 작업:
- `daily_records.timezone` 컬럼 추가 + 기존 행 `'Asia/Seoul'` 백필 → **해외 지원의 전제.
  나중에 넣으면 과거 기록의 tz를 복구할 수 없음**
- 하루 경계를 자정 → 해당 tz의 **새벽 4시**로 (프론트가 보내는 값과 맞춰야 함)
- GPS 업로드 body의 `timezone`, analyze 쿼리의 `?timezone=` 수용 (지금은 무시됨)
- tz는 오프셋 숫자가 아닌 **IANA 문자열**(`Asia/Seoul`)로 — 서머타임 대응
- 기존 `photos.taken_at` 보정 (테스트 데이터뿐이면 테이블을 비우는 편이 깨끗)
- 날짜 비교를 반개구간으로 통일 (인덱스 사용. `ai.py`의 `23:59:59` 경계 누락도 함께 해소)
- EXIF `OffsetTimeOriginal`이 있으면 우선 사용 (없을 때만 그날의 tz 폴백)
- Postgres `TimeZone` 확인 — compose에 `TZ` 미설정이라 UTC로 가정 중
- 목록 정렬 동점 처리: `order_by(created_at.desc(), id.desc())` (`blog.py:167`)
- `POST /blog/generate`에 구독·횟수 검사 + 초과 시 응답 코드 확정(402/403/429)

**해결됨** — `premium_started_at`·`billing_cycle`은 `SubscriptionResponse`에 추가됐고(PUT도 수용),
`POST /blog/{id}/publish`도 존재합니다. 프론트가 아직 안 쓰고 있을 뿐입니다.

**남은 것**
1. `GET /auth/me`에 `is_kakao_linked` — 현재 `{email}`만 반환. 프론트 타입은 준비돼 있음
2. **카카오 계정 연동 엔드포인트 자체가 없음** — `source=account-link` pass-through 이전에
   `/auth/kakao/link`가 구현돼 있지 않습니다. 로그인 콜백(`/auth/kakao/callback`)은 `code`만 받고
   `source`를 안 받으므로, 연동 흐름을 어떻게 태울지부터 정해야 합니다
3. 4시 경계·타임존 — 아래 "시간·타임존 정책"의 미결 항목. **`daily_records.timezone` 컬럼은
   나중에 넣으면 과거 기록의 tz를 복구할 수 없으므로 먼저 박는 게 이득**
