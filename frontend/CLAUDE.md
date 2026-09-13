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
├── onboarding.tsx                   # 이미지 8장 탭 넘김 → markOnboardingDone → 홈
│                                    # ((main) 바깥이라 권한 요청보다 먼저 끝난다)
├── (auth)/
│   ├── login.tsx / signup.tsx       # signup은 ConsentList로 동의 6항목을 받는다
│   ├── find-password.tsx            # 비밀번호 찾기 (이메일 발송)
│   ├── reset-password.tsx           # 비밀번호 재설정 (token 쿼리 파라미터)
│   └── kakao-login.tsx              # 카카오 OAuth 딥링크 콜백
└── (main)/
    ├── (tabs)/
    │   ├── _layout.tsx              # Header + SectionTabs + Slot + Footer
    │   ├── index.tsx                # home으로 redirect
    │   ├── home/index.tsx           # Calendar + BottomSheet
    │   └── journal-list/index.tsx   # 검색 + FlatList (무한 스크롤)
    ├── kakao-link.tsx               # 카카오 연동 딥링크 폴백 (아래 "카카오 연동" 참고)
    ├── write/index.tsx              # 프롬프트 입력 → AI 생성 (모아쓰기는 dates 파라미터)
    ├── write-preview/index.tsx      # 미리보기/저장 (리스트에서 진입 시 상세 조회)
    └── settings/
        ├── _layout.tsx              # 설정 전용 스택 (아래 "뒤로가기" 참고)
        └── index, account, subscription, theme, records
            # records: 위치 기록 토글 + 셀룰러 사진 업로드 토글 + 온보딩 다시 보기
```

### 인증 플로우

```
앱 시작 → app/index.tsx → hooks/useBootstrap.ts (준비 작업은 전부 여기에)
    ├── authStore.initialize()          # tokenStorage → authStore 동기화
    ├── 미인증 → /(auth)/login
    └── 인증   → 온보딩 여부에 따라 /onboarding 또는 홈

회원가입 → 동의 6항목(`constants/consent.ts`) 필수 5개 체크 → authApi.signup()
로그인   → authApi.login() → saveTokens() + authStore.setAuthenticated()
로그아웃 → authStore.logout() → removeTokens() + isAuthenticated=false
          → (main)/_layout이 stopGpsTracking() 후 /(auth)/login
카카오   → WebBrowser.openAuthSessionAsync()
          → roameapp://kakao-login?accessToken=...&refreshToken=...&isNewUser=True
          → login.tsx가 반환 URL을 파싱 → saveTokens()
            ├── isNewUser  → 동의 시트 (아직 setAuthenticated() 안 함)
            │                동의 → 홈 / 취소 → deleteAccount() 후 로그인 화면
            └── 기존 사용자 → 바로 홈
          (kakao-login.tsx는 딥링크가 라우터로 흘러들어올 때의 폴백.
           여기도 신규면 들여보내지 않고 /(auth)/login?consent=1로 보냅니다)
```

**카카오 신규 가입자 동의** — 카카오는 회원가입 화면을 거치지 않고 **백엔드 콜백에서
바로 계정이 만들어집니다.** 그래서 동의를 따로 받아야 하는데, 누가 신규인지는
백엔드가 딥링크에 실어주는 `isNewUser`로 판단합니다.

| 규칙 | 이유 |
|---|---|
| 값은 `parseIsNewUser()`로 읽는다 (`constants/kakao.ts`) | 백엔드가 파이썬 bool을 f-string에 넣어 보내 **값이 대문자 `'True'`** 입니다. `=== 'true'`로 비교하면 신규가 영영 안 잡힙니다. 판단이 안 서면 false — 확신 없이 띄우면 기존 사용자가 로그인할 때마다 시트를 봅니다 |
| 기기에 "동의함"을 남기지 않는다 | 예전 `utils/consentStorage.ts` 방식입니다. 재설치한 기존 사용자에게 또 묻고, 같은 기기에서 다른 계정으로 새로 가입하면 안 물어봅니다. 서버가 아는 것을 기기가 추측할 이유가 없습니다 |
| 동의 **전에** 토큰을 저장한다 | 취소했을 때 보내는 탈퇴 요청에 `Authorization`이 필요합니다 |
| 동의 전에는 `setAuthenticated()`를 부르지 않는다 | 인증 플래그가 켜지는 순간 `(main)`이 마운트되며 위치 권한을 묻기 시작해, 동의 시트가 그 다이얼로그에 가립니다 |
| 취소하면 `deleteAccount()`로 되돌린다 | 계정은 이미 만들어졌습니다. 시트만 닫으면 **동의 없이 가입된 계정**이 남습니다. 안드로이드 뒤로가기(`onRequestClose`)도 같은 경로로 보냅니다 |

### 카카오 연동 (로그인과 다른 흐름입니다)

**로그인은 토큰을 만들고, 연동은 만들지 않습니다.** 이걸 섞으면 연동에 성공하고도
로그아웃됩니다 — 그래서 딥링크 경로부터 갈라놨습니다.

```
설정 > 계정 "카카오 연동하기"
├── fetchKakaoLinkUrl()  GET /api/v1/auth/kakao/link   ← axios(토큰 필요)
│   서버가 user_id를 담은 5분 만료 JWT를 state로 심은 카카오 URL을 준다
├── openAuthSessionAsync(그 URL, roameapp://kakao-link)
├── 카카오 로그인 → 백엔드 콜백이 state로 "연동"임을 알아채고 social_id 저장
└── roameapp://kakao-link?success=true|false&reason=... → 반환 URL 파싱
    성공이면 fetchMe()로 재조회 (is_kakao_linked를 낙관적으로 켜지 않는다)
```

| 규칙 | 이유 |
|---|---|
| `/kakao/link`를 **브라우저로 직접 열지 않는다** | 이 엔드포인트는 `Authorization` 헤더로 누구의 연동인지 판단합니다. 시스템 브라우저는 앱의 토큰을 모르므로 401입니다. axios로 URL만 받아서 브라우저에 넘깁니다 |
| 딥링크는 `kakao-link`, 로그인은 `kakao-login` | 같은 경로를 쓰면 `kakao-login.tsx`가 "토큰 없음"으로 보고 `/(auth)/login`으로 보냅니다 |
| 결과는 `openAuthSessionAsync`의 **반환값**으로 처리한다 | 로그인(`login.tsx`)과 같은 방식입니다. `(main)/kakao-link.tsx`는 딥링크가 브라우저 세션이 아니라 라우터로 흘러들어올 때의 폴백일 뿐이라 **안내를 띄우지 않습니다** — 양쪽이 다 띄우면 두 번 뜹니다 |
| 실패 사유는 백엔드 문구를 그대로 쓴다 | `reason`이 사람이 읽을 한글입니다. 단 `invalid_state`만 코드라 프론트가 문장으로 바꿉니다 (state가 5분 만료라 카카오 로그인이 길어지면 실제로 납니다) |

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
| `DELETE /api/v1/auth/me` | `deleteAccount` | `settings/account/index.tsx` (204, cascade) |
| `GET /api/v1/auth/kakao/link` | `fetchKakaoLinkUrl` | `settings/account/index.tsx` (연동 시작 URL) |
| `GET /api/v1/calendar/{year}/{month}` | `fetchCalendarMonth` | `hooks/useCalendar.ts` |
| `GET /api/v1/calendar/{date}/timeline` | `fetchTimeline` | `hooks/useCalendar.ts` |
| `GET /api/v1/blogs` | `fetchBlogs` | `hooks/useJournalList.ts` (`q`·`date`·`page`·`size`) |
| `POST /api/v1/gps/logs` | `uploadGpsLogs` | `tasks/gpsTask.ts` (body에 `timezone` 동봉) |
| `POST /api/v1/gps/logs/{date}/analyze` | `analyzeGpsLogs` | `tasks/gpsTask.ts` (`?timezone=`) |
| `POST /api/v1/blog/generate` | `generateBlog` | `write/index.tsx` (하루는 `daily_record_id`, 모아쓰기는 `start_date`+`end_date`) |
| `GET /api/v1/blogs/{id}/status` | `fetchBlogGenerationStatus` | `waitForBlogGeneration` 폴링 |
| `GET /api/v1/blog/{id}` | `fetchBlogDetail` | `write-preview/index.tsx` |
| `PUT /api/v1/blog/{id}` | `updateBlog` | `write-preview/index.tsx` |
| `DELETE /api/v1/blog/{id}` | `deleteBlog` | `write-preview/index.tsx` (삭제 + 새 글 작성 취소, 204 소프트 삭제) |
| `GET /api/v1/subscriptions/me` | `fetchSubscription` | `settings/subscription`, `settings/theme` |
| `PUT /api/v1/subscriptions/me` | `subscribePremium`, `cancelSubscription` | `settings/subscription` (인앱결제 도입 시 잠길 예정) |
| `POST /api/v1/photos/upload` | `uploadPhoto` | `utils/photoSync.ts` (타임라인 카드 사진) |

백엔드에는 있으나 **프론트가 아직 안 쓰는** 엔드포인트:
`POST /api/v1/blog/{id}/publish`(발행 — 공개 기능이 생기면 붙일 자리),
`POST /api/v1/webhooks/revenuecat`(결제 웹훅 — 앱이 부르는 게 아니라 RevenueCat이 부릅니다).

외부 링크: 문의하기는 카카오 오픈채팅(`settings/index.tsx`의 `SUPPORT_CHAT_URL`)으로,
`Linking.openURL` 전에 확인 다이얼로그를 띄웁니다.

### 스타일링

NativeWind v4로 전체 스타일링. `StyleSheet.create`는 사용하지 않습니다.

인라인 `style` prop을 유지해야 하는 경우: `Animated.Value` 기반 값, `boxShadow` 문자열,
`contentContainerStyle`, `borderLeftColor` 등 동적 색상.

사진은 `expo-image`를 씁니다(디스크 캐시라 같은 날짜를 다시 열면 즉시 뜹니다).
className을 안 받아서 그 자리만 인라인 `style`입니다. **네이티브 모듈이라 재빌드가 필요합니다.**

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
| `ensureMediaLibraryPermission()` | **없음** — 사진 첨부 UI를 걷어내며 비었습니다. '사진 모아보기'용으로 남겨둔 것이니 "안 쓰는 코드"로 보고 지우지 마세요 | — |
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

**탭 전환 캐시** — 탭 레이아웃이 `Slot`이라 홈↔저널을 오갈 때마다 화면이 언마운트됩니다.
`useCalendar`·`useJournalList`가 마지막 성공 결과를 모듈에 남겨 리마운트 시 즉시 보여주고,
갱신은 뒤에서 진행합니다(stale-while-revalidate). 키(연-월 / 날짜)가 다르면 쓰지 않고,
검색 결과는 캐시하지 않으며, 조회 실패 시 무효화합니다.
**로그아웃 시 `(main)/_layout`이 비웁니다** — 다음 계정이 물려받으면 안 됩니다.

**사진 자동 업로드**(`utils/photoSync.ts`) — 앱 진입·복귀 시 오늘, 캘린더에서 날짜를 고르면
그 날짜. 날짜별 5분 간격, 회당 20장, 스크린샷 제외.
과거를 한꺼번에 훑지 않습니다 — 사진 한 장이 3~5MB라 한 달치면 수 GB입니다.

네트워크는 **와이파이면 항상, 셀룰러면 사용자가 켰을 때만**입니다
(설정 > 기록의 '셀룰러 환경에서 사진 업로드', 기본 끔). 연결 상태를 확인하지 못하면
올리지 않습니다 — 모르는 채로 올리면 요금이 사용자 돈으로 나갑니다.
값은 `utils/photoUploadStorage.ts`에 있습니다. `settingsStore`를 거치지 않고 디스크에서
직접 읽는 이유는 `photoSync`가 백그라운드에서도 도는 순수 유틸이라, 스토어를 끌어오면
`expo-location`까지 딸려와 테스트가 네이티브 모듈에 묶이기 때문입니다.

**analyze 호출 시점**(`utils/analyzeSchedule.ts`): GPS 배치마다가 아니라 **1시간 주기 + 논리 날짜가
넘어갔을 때 전날 확정 + 앱 진입·포그라운드 복귀(1분 가드)**. `lastAnalyzedDate`는 성공했을 때만
갱신해 실패한 날짜가 다음 주기에 자동 재시도됩니다.
연속 실패는 지수 백오프로 간격을 벌립니다(1→2→4분 … 60분 상한, 첫 실패는 즉시 재시도).
새로고침 버튼은 백오프를 무시합니다 — 사용자가 직접 누른 것입니다.

### GPS 업로드 큐

좌표는 `tasks/gpsTask.ts`가 받아 바로 올리지 않고 **`utils/gpsQueue.ts`의 큐를 거칩니다.**

| 규칙 | 이유 |
|---|---|
| 업로드 실패해도 큐에 남긴다 | 예전에는 실패한 배치가 그대로 사라져 지하철·엘리베이터·서버 재배포 구간이 통째로 비었습니다. 다음 배치에서 밀린 것까지 같이 올라갑니다 |
| 좌표마다 **주인(`ownerId`)을 적어둔다** | 좌표는 수집보다 몇 분 늦게 도착합니다. 그사이 계정을 바꾸면 이전 계정의 좌표가 새 계정에 저장됐습니다. 지금은 그 계정으로 로그인했을 때만 올립니다 |
| 주인은 **액세스 토큰(JWT)의 `sub`** 에서 읽는다 (`utils/currentUser.ts`) | 서버가 요청에 붙은 토큰으로 주인을 정하므로 어긋날 여지가 없습니다. `fetchMe()`는 네트워크가 필요해 응답 전·실패 구간의 좌표를 버리게 됩니다. 서명은 검증하지 않습니다 — 우리 디스크의 토큰에서 라벨만 읽고, 검증은 서버가 합니다 |
| `atob`을 쓰지 않고 base64url을 직접 푼다 | Hermes 버전에 따라 `atob`이 없습니다. 없으면 주인을 못 정해 업로드가 통째로 막힙니다 |
| 큐 접근을 한 줄로 세운다(`serialize`) | 읽기-수정-쓰기라 겹쳐 실행되면 한쪽 결과가 덮여 좌표가 사라집니다 |
| **로그아웃해도 큐는 비우지 않는다** | 아직 못 올린 좌표는 그 계정으로 다시 로그인할 때 올라갑니다. `(main)/_layout`이 다른 캐시를 비울 때도 여기만 남깁니다 |

상한: 5000건 / 2일 / 회당 500건. 위치 이력은 AsyncStorage에 평문으로 쌓이므로
오래 들고 있을수록 노출이 커집니다 — 재시도는 몇 시간이면 끝나고 계정 오귀속 대비도 하루면 충분합니다.
한 요청에 밀린 것을 통째로 실으면 15초 타임아웃에 걸려 큐가 더 커지는 악순환이 됩니다.

### 모아쓰기

캘린더에서 날짜를 **롱프레스**하면 선택 모드가 됩니다. 선택된 칸은 회색 네모(`rounded-md`),
평소 단일 선택은 하늘색 동그라미입니다.

| 규칙 | 이유 |
|---|---|
| 선택 모드 플래그를 두지 않는다 | 고른 게 있으면 선택 모드입니다. 플래그를 따로 두면 "0개인데 선택 모드"가 생깁니다. **마지막 하나를 해제하면 저절로 끝납니다** |
| `has_timeline`을 선택과 함께 저장한다 | 달을 넘겨도 선택이 유지되는데 `eventDays`는 보고 있는 달 것만이라 나중에 물어볼 수 없습니다 |
| 드래그로 선택하지 않는다 | 캘린더가 가로 드래그를 달 넘기기에 이미 씁니다(`onMoveShouldSetPanResponder`). 탭만 씁니다 |
| 선택 모드에서 단일 선택 강조를 숨긴다 | 동그라미와 네모가 같이 뜨면 어느 쪽이 글쓰기 대상인지 헷갈립니다 |
| 타임라인은 바뀌지 않는다 | 시트에는 원래 `selectedDate`의 기록이 그대로 보입니다 |
| 연속이면 범위, 불연속이면 목록으로 보낸다 | `buildDateTarget()`. **범위로 뭉뚱그리면 안 고른 날의 기록이 글에 들어갑니다** |

글쓰기 버튼은 고른 날 중 `has_timeline`이 하나라도 있어야 열립니다 — 전부 빈 날이면
서버가 "해당 기간에 기록이 없습니다"로 거절합니다. 개수와 "선택 해제"는 `HomeFooter`
왼쪽에 있습니다(시트가 캘린더를 가려도 보이는 유일한 자리).

### 이 날의 일기

홈 푸터의 글쓰기 왼쪽 버튼입니다. 누르면 저널 탭으로 가면서 그 날짜의 글만 남깁니다.

| 규칙 | 이유 |
|---|---|
| 검색어가 아니라 `date=` 파라미터로 거른다 | 검색어 칸에 날짜를 적어 넣으면 사용자가 글자를 지우는 순간 필터가 깨집니다. 무엇보다 **모아쓰기 글은 제목·본문에 그 날짜가 없어 검색으로 못 잡습니다**(`'26.09.05 외 4일'`은 표시용 문자열입니다) |
| 그날 글이 있을 때만 버튼을 띄운다 | 빈 목록으로 보내면 "고장났나"로 읽힙니다. 판단은 캘린더가 주는 `has_journal`이고, `timelineStore.selectedDateKey`·`hasJournal`로 전달합니다 |
| 모아쓰기 선택 모드에서는 숨긴다 | 그 자리는 "N일 선택됨 · 선택 해제"가 씁니다 |
| 탭 이동이라 `replace`를 쓴다 | `SectionTabs`와 같은 방식입니다. `push`면 뒤로가기 스택에 탭이 쌓입니다 |
| 검색하면 날짜 필터가 풀린다 | 둘이 같이 걸리면 목록이 왜 그런지 알 수 없습니다 |
| 날짜 필터 결과는 캐시하지 않는다 | 첫 페이지 캐시는 조건 없는 목록 전용입니다. 섞이면 다음 진입에 엉뚱한 목록이 뜹니다 |

> **모아쓰기 글은 시작일로만 걸립니다.** 백엔드 `get_blog_list()`의 날짜 필터가
> `Blog.target_date == date` 하나라, 8/5~8/9 글은 8/5로만 잡히고 8/7로는 안 나옵니다.
> `period_end`(연속)와 `target_dates`(불연속)를 같이 봐야 합니다 — 백엔드 요청 대기.

### 장소 수정·삭제

타임라인 카드를 **왼쪽으로 밀면** 수정·삭제가 드러납니다(`components/common/SwipeableRow.tsx`).

| 규칙 | 이유 |
|---|---|
| 가로가 세로보다 클 때만 제스처를 가져온다 | 카드가 시트 안 `ScrollView`에 있습니다. 조건 없이 잡으면 세로 스크롤을 뺏습니다. `BottomSheet`의 `panHandlers`는 핸들·날짜 헤더·지도에만 붙어 있어 그쪽과는 원래 안 부딪힙니다 |
| 열린 행은 항상 하나 | 여러 개가 열려 있으면 어느 걸 지우는지 헷갈립니다. 모듈 변수로 직전 행을 닫습니다 |
| 거리뿐 아니라 속도도 본다 (`shouldOpen`) | 짧게 튕기는 동작이 흔한데 거리만 보면 안 열립니다 |
| 삭제는 확인 팝업을 거친다 | 되돌릴 수 없습니다 |

수정은 아래에서 시트가 올라옵니다(`PlaceEditSheet` → `components/common/BottomActionSheet.tsx`).

```
근처 후보 5개 → '없어요' → 이름 입력(치는 동안 그 키워드로 재검색)
                              → 그래도 없으면 카테고리 칩
```

| 규칙 | 이유 |
|---|---|
| 후보를 고르면 카테고리를 묻지 않는다 | 후보에 카테고리가 딸려옵니다. 대부분 탭 한 번으로 끝납니다 |
| 직접 입력은 단순 텍스트 교체가 아니다 | 친 글자로 지도를 다시 검색합니다. "없어요"까지 온 경우는 대개 "반경 밖이지만 등록은 된 곳"입니다 |
| 카테고리 칩은 마지막 폴백 | 카테고리는 **닫힌 목록이 아닙니다** — 카카오 원문 문자열과 구글 type 매핑값이 섞여 들어옵니다. 칩은 미등록 장소용 몇 개일 뿐입니다 |
| 좌표는 건드리지 않는다 | 핀은 GPS 체류 중심점을 유지합니다. 지도는 Static Maps 이미지라 저장된 좌표를 바꾸지 않는 한 그대로입니다 |
| 시간도 건드리지 않는다 | 사진이 `arrived_at ≤ taken_at ≤ left_at`로 붙습니다. 시간을 줄이면 붙어 있던 사진이 떨어지고 늘리면 옆 장소 것을 빨아들입니다 |
| 시트는 `Modal`이다 | RN이 별도 레이어에 그려서 홈 바텀시트의 `PanResponder`와 안 부딪힙니다 |

> **`services/placeApi.ts`의 엔드포인트는 아직 백엔드에 없습니다.** 경로·형식은 합의된 스펙이고,
> 붙기 전까지 호출하면 404라 시트가 "주변 장소를 불러오지 못했어요"로 떨어집니다.
> 백엔드에 남은 일: 후보 조회 중계, `PATCH`/`DELETE /places/{id}`,
> 수정 시 `is_corrected=True`, **재분석 때 수정본과 같은 시간대의 stay를 건너뛰기**
> (안 하면 같은 시각에 장소가 두 개 남습니다), 삭제한 장소가 재분석에 되살아나지 않게,
> `place_count` 재계산.

### 뒤로가기

`(main)`은 **iOS 스와이프 뒤로가기를 끕니다**(`gestureEnabled: false`). 글쓰기·미리보기에서
스와이프로 빠져나가면 취소 처리를 건너뛰어 생성한 글이 서버에 남습니다.

설정만 예외입니다. 두 군데에서 켭니다 — `(main)/_layout`의 `<Stack.Screen name="settings">`가
설정에서 홈으로 나가는 것을, `settings/_layout.tsx`가 설정 안쪽 이동을 담당합니다.
제스처 설정은 네비게이터 단위라 바깥을 끈 채 안쪽만 켤 수 있습니다.

안드로이드 하드웨어 뒤로가기는 별개라 `write-preview`가 `BackHandler`로 직접 막고
Cancel과 같은 확인 경로로 보냅니다.

**제스처 옵션만 믿지 않습니다.** New Architecture에서 `gestureEnabled`가 무시된 적이 있어,
`write`·`write-preview`가 `beforeRemove`로 이탈을 한 번 더 가로챕니다.
**`GO_BACK`만 막습니다** — `router.replace`(Home·취소·저장)까지 막으면 나갈 길이 없어집니다.

### 토큰 저장

`utils/tokenStorage.ts`가 **`expo-secure-store`**(iOS Keychain / Android Keystore)를 씁니다.
AsyncStorage는 암호화되지 않아 iOS 백업에 평문으로 실립니다.
예전 AsyncStorage 값은 읽을 때 자동으로 옮기고 평문 사본을 지웁니다 — 이게 없으면
업데이트 시 기존 로그인이 전부 풀립니다. **네이티브 모듈이라 `npx expo run:ios` 재빌드가 필요합니다.**

### 구독 상태

서버가 단일 출처입니다. `subscriptionStore`가 들고 있고, **프리미엄 기능 개방 판정은
`isPremium()` 하나만 봅니다** (`plan === 'premium' && isActive && 만료 전).

| 규칙 | 이유 |
|---|---|
| `plan`을 프론트가 직접 정하지 않는다 | 낙관적 업데이트를 하면 결제 검증 실패 시 유료 기능이 잠깐 열립니다. 진행 표시가 필요하면 `plan` 대신 별도 로딩 플래그를 쓰세요. **eslint(`no-restricted-syntax`)가 화면에서의 `setState` 호출을, TS `readonly`가 필드 대입을 막습니다** |
| 조회 실패 시 `free`로 떨어뜨린다 | 모를 때 프리미엄으로 두면 조회 실패가 곧 유료 기능 개방이 됩니다 |
| 프리미엄이 끊기면 프리미엄 테마를 `basic`으로 되돌린다 | `refresh()`가 처리합니다. 대상은 `constants/themes.ts`의 `PREMIUM_THEMES` |
| `expires_at`이 지났으면 서버가 `active`라 해도 만료로 본다 | 앱을 오래 켜둔 채 만료가 지나는 경우 |
| `will_renew`는 **판정에 넣지 않는다** | 해지를 예약해도 만료일까지는 프리미엄입니다. 판정에 넣으면 돈 낸 기간이 잘립니다. 이 값은 "해지 예약됨 · X일까지 이용 가능" 문구에만 씁니다 |

재조회 시점은 `useSubscriptionSync`(앱 진입 + `AppState` 복귀)와 결제·해지 직후입니다.
인앱결제는 시스템 다이얼로그라 앱 밖에서 완료될 수 있어 복귀 갱신이 특히 중요합니다.
로그아웃 시 `(main)/_layout`이 `reset()`으로 비웁니다 — 다음 계정이 물려받으면 안 됩니다.

**만료 안내** — 프리미엄이 끊기면 `useSubscriptionSync`가 Alert을 띄웁니다
(`justExpired` → 안내 → `acknowledgeExpiry()`). 세 가지를 지킵니다:

| | |
|---|---|
| 직전 상태를 **디스크에** 남긴다 (`utils/subscriptionStorage.ts`) | 만료는 대개 앱이 꺼져 있을 때 지납니다. 앱을 켜면 스토어가 free에서 시작하므로 메모리 비교로는 "프리미엄이었다"를 알 길이 없습니다 |
| **조회에 성공했을 때만** 만료로 본다 | 규칙 2(실패 시 free 강등)를 만료로 오인하면 비행기 모드일 뿐인데 "구독이 만료됐어요"가 뜹니다. 실패 시 디스크 값도 건드리지 않아 다음에 진짜 만료를 잡습니다 |
| 안내 **전에** 플래그를 끈다 | 사용자가 알림을 닫기 전에 앱 복귀로 `refresh()`가 또 돌면 안내가 쌓입니다 |

이 값은 **안내용이지 판정용이 아닙니다.** 기능 개방은 언제나 `isPremium()`만 봅니다.

**결제 주기**(`billingCycle`) — `FreeView`에서 고른 값이 `subscribePremium(cycle)`로
서버까지 갑니다. 서버는 `monthly`/`annual`을 받아 만료일을 30일/365일로 계산하므로
**안 보내면 연간을 고른 사람이 30일 뒤 끊깁니다.** `PremiumView`의 현재 플랜 표시도
서버가 주는 `billing_cycle`을 씁니다. 이 값도 표시·요청용이지 판정용이 아닙니다.

> 프론트의 `isPremium()`은 **UI 표시용이지 보안 경계가 아닙니다.**
> 비용이 드는 기능은 서버가 막습니다 — 무료 사용자의 AI 글 생성은 **주 3회**로 제한되고
> (월요일 새벽 4시 KST 리셋), 초과하면 백엔드가 429를 반환합니다.
> 프론트는 `utils/blogGenerationError.ts`가 그 응답의 `reset_at`을 읽어
> "8월 10일부터 다시 쓸 수 있어요"로 안내합니다.

### 결제 (인앱결제)

RevenueCat을 씁니다. **앱은 영수증을 서버로 보내지 않습니다** — SDK가 Apple과 결제하고,
RevenueCat이 검증한 뒤 백엔드로 웹훅을 보냅니다.

```
로그인 → identifyUser()로 결제 SDK에 user_id 알림 (services/purchases.ts)
결제   → SDK → Apple → RevenueCat 검증 → 백엔드 웹훅 → 구독 상태 갱신
앱     → refreshUntilChanged()로 재조회 (웹훅이 몇 초 늦으므로 0/1.5/3/5초 재시도)
```

`user_id`가 없으면 웹훅이 와도 누구 결제인지 매칭되지 않습니다. 로그인 경로가 셋
(이메일 / 카카오 버튼 / 카카오 딥링크)이라 `(main)/_layout`에서 인증 상태로 한 번만 부릅니다.

SDK(`react-native-purchases`)와 콘솔 설정(상품 등록·유료 계약·RevenueCat 대시보드·웹훅)은
**모두 끝났습니다.** 키(`EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `_ANDROID_KEY`)는 `.env`에 있고,
키가 비면 `isPurchaseAvailable()`이 false가 되어 **결제 기능만 조용히 꺼지고 앱은 그대로
동작합니다** — CI나 새 클론에서 결제 화면이 비어 보이면 대개 키가 없는 것입니다.

| 규칙 | 이유 |
|---|---|
| 상품 ID는 백엔드와 글자 단위로 같아야 한다 | `services/purchases.ts`의 `PRODUCT_IDS`와 백엔드 `revenuecat_webhook.py`의 `PRODUCT_PLAN_MAP`. 다르면 결제는 되는데 웹훅이 어느 플랜인지 몰라 구독이 안 열립니다 (`com.picknavi.roame.premium.monthly` / `.annual`) |
| 앱은 SDK의 구독 상태를 **판정에 쓰지 않는다** | SDK 캐시와 서버가 어긋날 때 웹훅으로 정산하는 서버가 맞습니다. 그래서 Entitlement를 들여다보지 않고, 결제 후 `refreshUntilChanged(false)`로 서버에 물어봅니다 |
| 가격은 `getOfferings()`가 준 것을 쓴다 | 같은 상품이 나라마다 다른 금액으로 청구됩니다. 못 받아오면 `constants/pricing.ts`의 국내 기준 값으로 그립니다 |
| 결제 취소는 오류가 아니다 | 사용자가 시스템 다이얼로그를 닫은 것입니다. `purchase()`가 `'cancelled'`를 따로 돌려주고, 화면은 아무것도 띄우지 않습니다 |
| 해지·결제수단 변경은 **앱스토어로 보낸다** | 구독의 실체가 Apple에 있어 우리 DB만 바꾸면 결제가 계속됩니다. `constants/store.ts`의 `APP_STORE_SUBSCRIPTIONS_URL` |
| **구매 복원이 있어야 한다** | 기기 변경·재설치 때 되찾을 경로가 없으면 **Apple 심사에서 리젝됩니다.** `FreeView` 하단의 "구매 복원" |
| **자동 갱신 고지와 약관 링크를 지우지 않는다** | 심사 지침 3.1.2가 결제 화면 안에 요구합니다 — 갱신 주기·해지 시한·청구 시점·관리 경로, 그리고 이용약관·개인정보처리방침 링크(`constants/legal.ts`). `FreeView`의 `AUTO_RENEW_NOTICE`와 하단 링크가 그것입니다 |

`subscriptionApi.ts`의 `subscribePremium`·`cancelSubscription`은 **화면에서 부르지
않습니다**(`@deprecated`). 앱이 그 API로 plan을 바꾸면 Apple과 우리 DB가 어긋나
결제하지 않은 사용자가 프리미엄이 되거나 해지했는데 청구가 이어집니다.

콘솔 쪽이 어긋나면 코드가 아니라 여기를 먼저 봅니다:

| | 확인할 것 |
|---|---|
| App Store Connect | 자동 갱신 구독 2개가 `PRODUCT_IDS`와 **글자 단위로** 같은지. 상품이 "준비 안 됨"이면 유료 계약(Paid Applications Agreement)부터 |
| RevenueCat | Entitlement/Offering 구성. `getOfferings()`가 빈 배열이면 가격이 `constants/pricing.ts`의 국내 기준값으로 그려집니다 |
| 웹훅 | Authorization 비밀값이 백엔드 `REVENUECAT_WEBHOOK_SECRET`과 같은지. 결제는 되는데 구독이 안 열리면 대개 여기 |

### BottomSheet

PanResponder로 3단계 스냅: `0`(expanded), `sheetHeight - peekHeight`(peek),
`sheetHeight - 30`(handleOnly). translateY가 `sheetHeight * 0.45` 미만이면
MapPreview가 페이드인됩니다(`isMapMounted` + `mapOpacity`).

### 글쓰기 플로우

```
HomeFooter 글쓰기 버튼 → /(main)/write (dailyRecordId 전달)
├── 프롬프트 + 스타일(정보 위주 / 감성적) → POST /blog/generate (202 + blog_id)
├── waitForBlogGeneration: status 폴링 → completed 시 상세 조회
│   (대기 화면은 RotatingMessage가 문구를 갈아 끼운다 — 위 "훅" 참고)
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
                        selectedDateKey, hasJournal / setSelectedDay
                        — HomeFooter의 "이 날의 일기" 버튼용
store/themeStore.ts     themeId, themeVars / setTheme, initialize, reset
                        reset은 로그아웃용 — 테마는 기기가 아니라 계정에 딸린 설정입니다
store/subscriptionStore.ts  plan, billingCycle, isActive, expiresAt, willRenew,
                        hasLoaded, justExpired
                        / isPremium(), refresh, refreshUntilChanged,
                          acknowledgeExpiry, reset
store/dateSelectionStore.ts  selected('YYYY-MM-DD' → has_timeline) / toggle, clear
                        모아쓰기 날짜 선택. 선택 모드 플래그는 두지 않습니다 —
                        고른 게 있으면 선택 모드입니다
store/settingsStore.ts  isTrackingEnabled, isCellularUploadEnabled, hasLoaded
                        / initialize, setTrackingEnabled, setCellularUploadEnabled
                        위치 기록 토글은 기본 켬 — 끄면 stopGpsTracking(), 켜면 startGpsTracking().
                        셀룰러 사진 업로드는 기본 끔 (요금이 사용자 돈이라)
```

### 훅

```
hooks/useBootstrap.ts     앱 시작 준비 — 토큰 복원 → 진입 화면 결정
hooks/usePermissions.ts   권한 확인·요청·거부 안내 (아래 "권한 정책" 참고)
hooks/useCalendar.ts      selectedDate, viewDate, calendarDays, places + fetch
hooks/useGpsTracking.ts   start() / stop()
hooks/useThemeColors.ts   현재 테마 색상 값 (prop 용)
hooks/useSubscriptionSync.ts  구독 재조회 시점 (앱 진입 + AppState 복귀) + 만료 안내
hooks/useJournalList.ts   저널 목록 — 서버 검색(제출식) + 날짜 필터 + 페이지네이션
                          query(입력 중)와 appliedQuery(지금 목록의 검색어)를 나눠 둡니다.
                          하이라이트·빈 목록 문구는 appliedQuery를 씁니다
hooks/useDailyAnalyze.ts  앱 진입·복귀 시 오늘 analyze → 성공 시 requestRefresh()
hooks/usePhotoSync.ts     앱 진입·복귀 시 오늘 사진 자동 업로드 (과거는 useCalendar가 고른 날짜만)
utils/timezone.ts         getDeviceTimeZone() — 서버로 보낼 IANA tz
utils/gpsQueue.ts         GPS 좌표 큐 — 실패 시 보관, 주인 표시 (위 "GPS 업로드 큐" 참고)
utils/currentUser.ts      액세스 토큰(JWT)의 sub — 좌표의 주인. 서명은 검증하지 않습니다
utils/consentStorage.ts   카카오 가입자의 동의 여부 (이메일 가입은 signup 화면에서 받습니다)
utils/onboardingStorage.ts  온보딩 완료 여부 — useBootstrap이 진입 화면을 정할 때 봅니다
utils/analyzeError.ts     분석 실패를 사용자 문구로 (404 기록 없음 / 502 분석 서버 / 타임아웃 구분)
utils/logError.ts         오류를 **message만** 찍습니다 — 카카오 콜백 URL에 토큰이 실려 있어
                          통째로 출력하면 기기 로그에 남습니다 (릴리스에도 console은 들어갑니다)
utils/analyzeSchedule.ts  analyze 호출 시점 (위 "데이터 재조회 정책" 참고)
utils/photoSync.ts        그 날짜 사진 스캔 → 안 올린 것만 업로드
                          (날짜별 5분 간격, 와이파이일 때만, 스크린샷 제외, 회당 20장)
utils/subscriptionStorage.ts  직전 프리미엄 여부 (만료 안내 전용, 판정에 쓰지 않음)
utils/photoUploadStorage.ts  셀룰러 업로드 허용 여부 — settingsStore와 photoSync가 함께 읽습니다
constants/legal.ts        이용약관(Apple 표준 EULA) · 개인정보처리방침 URL (둘 다 실주소)
constants/consent.ts      가입 동의 항목 — 조 번호가 처리방침 문서와 짝입니다.
                          **문서를 고치면 여기도 같이 봅니다.** 이메일·카카오가 같은 목록을 씁니다
services/purchases.ts     결제 SDK — 초기화·사용자 식별·가격 조회·결제·복원
utils/blogGenerationError.ts  글 생성 실패를 사용자 문구로 (429는 reset_at까지 읽음)
utils/loadingSequence.ts  글 생성 대기 문구 순서 — 진행 안내↔튜토리얼 교대, 튜토리얼은 매번 셔플
constants/loadingMessages.ts  그 문구 목록과 교체 간격
components/write/RotatingMessage.tsx  문구 표시 — 점이 차오르다(`.`→`...`) 페이드로 교체
components/common/PhotoViewer.tsx  사진 전체 화면 보기 (아무 데나 누르면 닫힘)
components/common/SwipeableRow.tsx  왼쪽으로 밀면 동작 버튼이 드러나는 행
components/common/BottomActionSheet.tsx  아래에서 올라오는 시트 (배경 딤 + 손잡이)
components/bottomsheet/PlaceEditSheet.tsx  장소 수정 — 후보 고르기 → 직접 입력
constants/placeCategories.ts  직접 입력용 카테고리 칩 (전체를 덮지 않습니다)
components/bottomsheet/BottomSheet.tsx  groupPlaces() — 타임라인을 시(hour)로 묶습니다.
                          같은 시라도 시간대가 다르면 다른 묶음입니다 (위 "타임존" 참고)
```

### 유틸 (`utils/formatDate.ts`)

| 함수 | 변환 |
|---|---|
| `toDateKey(date)` | **달력 날짜** → `'YYYY-MM-DD'`. 경계 보정 안 함 (캘린더에서 고른 날짜용) |
| `toLogicalDateKey(date)` | **순간** → 그 순간이 속한 논리적 하루. 새벽 4시 이전은 전날 (GPS timestamp용) |
| `logicalToday()` | 지금이 속한 논리적 하루의 로컬 자정 `Date` (캘린더 "오늘") |
| `formatDate(date)` | `Date` → `'YY.MM.DD(day)'` |
| `formatDateStr(str)` | `'YYYY-MM-DD'` → `'YY.MM.DD(day)'` |
| `formatTimeFromISO(iso, offset?)` | ISO 8601 → `'12:00PM'`. `offset`(분)을 주면 **그 장소의 현지 시각**, 없으면 기기 로컬 |
| `hourFromISO(iso, offset?)` | 위와 같은 기준의 '시'(0~23) — `groupPlaces`가 묶음 키로 씁니다 |
| `formatDateFromISO(iso)` | ISO 8601 → `'YY.MM.DD(day)'` |
| `formatTimeAgo(iso)` | ISO 8601 → `'방금'` / `'N분 전'` 등 |
| `formatShortDate(date)` | `Date` → `'YY.MM.DD'` (요일 없이) |
| `formatRecordDateLabel(date, dates?)` | 위치 기록일 표기. 모아쓰기는 `'26.09.05 외 4일'`. 저널 카드와 미리보기가 함께 씁니다 |

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
| `__tests__/formatDate.test.ts` | `utils/formatDate.ts` | 새벽 4시 경계, 달력 날짜와 순간의 구분, 12AM/PM, `formatTimeAgo` 임계값, `formatRecordDateLabel`(하루/모아쓰기/해석 실패) |
| `__tests__/timezone.test.ts` | `utils/timezone.ts` | expo-localization → Intl → Asia/Seoul 폴백, `UTC` 오탐 처리 |
| `__tests__/pricing.test.ts` | `constants/pricing.ts` | 할인율을 손으로 적지 않고 두 가격에서 계산, 레이블에 그 값이 들어감 |
| `__tests__/kakao.test.ts` | `constants/kakao.ts` | base URL 끝 슬래시 제거(카카오는 redirect_uri를 문자 단위로 비교), 앱 딥링크와 백엔드 콜백 구분, 로그인·연동 딥링크 분리 |
| `__tests__/photoSync.test.ts` | `utils/photoSync.ts` | 논리적 하루 범위, 스크린샷 제외, ph:// → localUri, 중복 방지, 실패 시 재시도, 와이파이 게이트, **셀룰러는 설정을 켰을 때만**(연결 없으면 켜도 안 올림), 날짜별 간격 가드, 로그아웃 시 기록 삭제 |
| `__tests__/gpsTask.test.ts` | `tasks/gpsTask.ts` | 좌표 변환, 업로드 실패 시 분석으로 안 넘어감, 분석은 스케줄러에 위임 |
| `__tests__/analyzeSchedule.test.ts` | `utils/analyzeSchedule.ts` | 1시간 주기 가드, 날짜 넘어감 감지, 실패 시 기준 날짜 미갱신(재시도), 백그라운드·포그라운드가 시각 공유, 연속 실패 백오프 |
| `__tests__/loadingSequence.test.ts` | `utils/loadingSequence.ts` | 진행↔튜토리얼 교대, 진행 안내는 안 섞음, 튜토리얼 누락 없음, 원본 불변, 개수가 달라도 이어 붙임 |
| `__tests__/blogApi.test.ts` | `waitForBlogGeneration` | completed/failed 분기, **15회(37.5초) 타임아웃 상한** |
| `__tests__/staticMapUrl.test.ts` | `utils/staticMapUrl.ts` | 키 없으면 null, 장소 0/1/N개별 center·zoom, 미리보기와 저장본이 같은 시야 |
| `__tests__/authStore.test.ts` | `authStore` + `tokenStorage` + `onboardingStorage` | 토큰을 store에 복제하지 않음, `clearAuth`와 `logout`의 차이, `initialize` 복원 |
| `__tests__/subscriptionStore.test.ts` | `subscriptionStore` | 조회 실패 시 free 강등, 만료 판정, 프리미엄 테마 basic 복귀, 해지 예약(`willRenew`)은 판정에 넣지 않음, 결제 후 재조회 재시도, 결제 주기 반영, 만료 안내(앱 재시작 후에도 감지·조회 실패는 만료 아님·로그아웃 시 기록 삭제) |
| `__tests__/dateSelection.test.ts` | `dateSelectionStore` + `buildDateTarget` | 0개면 선택 모드 종료, 여러 개 중 하나만 해제 시 유지, 정렬, 기록 없는 날만 고르면 잠금, 달 넘긴 선택의 기록 여부 기억, 연속↔불연속 판정 |
| `__tests__/api.interceptor.test.ts` | `utils/api.ts` 401 인터셉터 | 재발급 대기 큐가 반드시 풀리는지 (리프레시 토큰 없음 / 빈 토큰) |
| `__tests__/swipeableRow.test.ts` | `shouldOpen` | 거리·속도로 열림 판정, 스치듯 민 건 안 열림, 반대로 튕기면 취소, 버튼이 넓으면 더 밀어야 함 |
| `__tests__/settingsStore.test.ts` | `settingsStore` | 기본값 켬, 복원, 켜고 끌 때 GPS 시작·정지, 같은 값이면 무동작, 저장 실패 시 세션 반영, 셀룰러 업로드 기본 끔·복원·위치 토글과 독립 |
| `__tests__/currentUser.test.ts` | `utils/currentUser.ts` | 토큰의 `sub`를 읽음, 없거나 깨진 토큰은 null(던지지 않음), 토큰이 바뀌면 주인도 바뀜 |
| `__tests__/timelineGrouping.test.ts` | `groupPlaces` | 같은 시끼리 묶음, **시가 같아도 시간대가 다르면 다른 묶음**, 서버 순서 유지(자정 넘김), 오프셋 없으면 기기 시간대(구버전 서버) |
| `__tests__/themeStore.test.ts` | `themeStore` | 디스크 저장·복원, 알 수 없는 값 무시, 로그아웃 시 basic 복귀 + 디스크 삭제, reset 후 initialize가 되살리지 않음 |
| `__tests__/analyzeError.test.ts` | `utils/analyzeError.ts` | 404·502·타임아웃·네트워크를 다른 문구로, 모르는 상태 코드는 숫자를 남김 |
| `__tests__/blogGenerationError.test.ts` | `utils/blogGenerationError.ts` | 429는 `reset_at`까지 안내(없거나 깨져도 안내는 나감), 409는 생성 중, 폴링 타임아웃은 실패가 아니라 "아직 만드는 중" |
| `__tests__/photoApi.test.ts` | `services/photoApi.ts` | 필드명 `photo` 고정(다르면 422), 확장자별 MIME(HEIC), 60초 타임아웃 |
| `__tests__/useJournalList.test.ts` | `useJournalList` | 타이핑만으로 요청하지 않음, `appliedQuery`는 응답과 함께 바뀜, 더 불러오기가 목록의 검색어를 씀, 늦게 온 응답 무시, 페이지 이어붙이기, 실패 시 기존 목록 유지, 날짜 필터(캐시 안 씀·더 불러오기 승계·검색하면 풀림) |

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

> **하루 경계 4시는 백엔드에도 반영됐습니다** — `config.DAY_BOUNDARY_HOUR=4`,
> `utils/timezone.py`의 `day_bounds()`·`week_bounds()`. 새벽 0~4시 GPS 유실은 해소됐습니다.
>
> analyze의 `?timezone=`은 `daily_records.timezone`에 저장되고(**기록 생성 시에만**),
> **`day_bounds(target_date, tz_name)`이 그 값을 실제로 씁니다** —
> `services/calendar.py`는 `record.timezone`을, `services/ai.py`는 요청의 tz를 넘깁니다.
> 알 수 없는 이름은 `resolve_tz()`가 KST로 떨어뜨립니다(기기가 보낸 문자열이라
> 막지 않으면 오타 하나로 분석이 500이 됩니다). **해외 베타 블로커는 해소됐습니다.**
>
> `week_bounds()`는 여전히 KST 고정입니다 — 무료 주 3회 리셋용이라 전 사용자가
> 같은 시점에 리셋되는 편이 맞습니다. 해외 사용자에게는 "이번 주"가 한국 월요일 04시입니다.

### tz 정책 (결정됨)

| | |
|---|---|
| **어느 날짜에 속하나** | 그날 레코드가 **처음 만들어질 때의 tz 하나로 고정** (`daily_records.timezone`). 한 번 정해지면 안 바뀝니다 — 나중에 옮기면 이미 저장된 기록이 다른 날짜로 튑니다 |
| **몇 시로 보이나** | **그 장소의 현지 시각.** 서버가 `TimelinePlace`에 `timezone`·`utc_offset_minutes`를 실어주고, `formatTimeFromISO(iso, offset)`이 그 오프셋으로 그립니다. 오프셋이 없으면(구버전 서버) 기기 tz로 폴백합니다 |

비행기 탄 날 하루는 출발지 기준으로 잘립니다. **다음 날부터는 도착지 tz로 저절로 넘어갑니다** —
새 날의 레코드가 도착지에서 만들어지기 때문입니다. 그 하루는 감수합니다.

현지 시각으로 그리므로 **서쪽으로 갈 때 카드의 시각이 거꾸로 갑니다**
(서울 10:00 출발 → LA 03:00 도착). 순서는 `arrived_at`(UTC) 기준이라 맞습니다 —
버그로 보이지 않도록 `groupPlaces`가 **시간대가 바뀌는 자리를 따로 끊고**
(`isTimezoneChange`), 시가 같아도 tz가 다르면 다른 묶음으로 둡니다.
서버가 준 순서는 절대 다시 정렬하지 않습니다.

GPS 업로드 body의 `timezone`은 **받지만 쓰지 않습니다.** 하루의 tz는 analyze의
`?timezone=`으로 충분합니다. 로그별 tz는 하루 경계를 정하는 데 쓰이지 않아 두지 않습니다.

EXIF에 `OffsetTimeOriginal`이 있으면 그 tz를 쓰고, **없으면 KST로 간주합니다.**
해외에서 오프셋 없이 찍은 사진은 어느 장소에도 안 붙지만, 엉뚱한 곳에 붙지는 않습니다.

### 남은 미결

1. 4시 경계를 **표시**에도 적용할지 — 새벽 3시 기록을 `3:00AM`으로 볼지 `27:00`으로 볼지

> 구독 횟수 리셋은 **월요일 새벽 4시(KST)** 로 정해졌습니다. 무료 주 3회.

## 알려진 문제

| 문제 | 위치 | 영향 | 담당 |
|---|---|---|---|
| AI 생성 폴링이 37.5초에서 끊김 | `blogApi.ts` `waitForBlogGeneration` | 실제로는 성공했는데 "생성 실패"로 표시. 상한을 늘리려면 `__tests__/blogApi.test.ts`도 같이 고쳐야 합니다 | 프론트(글쓰기) |
| 로깅 설정이 없음 | `backend/app/main.py` | `basicConfig`가 없어 앱 로거의 INFO는 사라지고 ERROR는 포맷 없이 찍힙니다. 장애 때 원인 추적이 어렵습니다 | 백엔드 |

## 미구현 / TODO

| 항목 | 위치 | 비고 |
|---|---|---|
| `beforeRemove` 훅으로 묶기 | `write`, `write-preview` | 뒤로가기 차단 로직이 두 화면에 복제됨. 막을 화면이 하나 더 생기면 `useConfirmBeforeLeave`로 |
| 입력 필드 컴포넌트화 | `write/index.tsx` | 같은 모양의 `레이블 + TextInput` 4벌. `LabeledTextInput`으로 빼면 60줄쯤 줄어듦 |
| `write-preview` 분해 | `write-preview/index.tsx` | 315줄에 조회·수정·저장·삭제·취소가 다 있음. `useBlogDraft()` 훅 분리 — 라우터 파라미터로 본문 넘기는 문제와 같이 정리 |
| `RotatingMessage` 위치 | `components/write/` | write 전용이 아닌 범용 컴포넌트. 두 번째 사용처가 생기면 `components/common/`으로 |
| 리포트 | — | 와이어프레임 대기 |
| 사진 모아보기 | `settings/records` | 다른 담당자 구현 중. 설정 > 기록 화면에 붙일 자리를 만들어 뒀습니다 |
| 크래시 리포팅 | — | Sentry 등이 없어 출시 후 사용자 크래시를 알 방법이 없습니다. **RN의 JS 에러는 App Store Connect 크래시 리포트에 안 잡힙니다** |
| 남은 생성 횟수 표시 | 글쓰기 | 지금은 429가 떠야만 `used/limit`을 알 수 있습니다. `GET /subscriptions/me`에 넣어주면 "이번 주 1/3" 안내가 가능합니다 |
| 카카오 첫 가입자 닉네임 | `(auth)/login.tsx:107` | 백엔드는 카카오 `properties.nickname`을 받아 쓰고 **못 받을 때만** `카카오유저1234`로 폴백합니다(`services/auth.py:88`) — 고정이 아닙니다. 먼저 볼 것은 **카카오 콘솔의 프로필 정보 동의항목**. 화면을 만들려면 닉네임 수정 API(`PATCH /me` 부재)가 전제이고, 지금은 닉네임이 앱 어디에도 안 보여 우선순위가 낮습니다 |
| 장소 수정·삭제 API | `services/placeApi.ts` | 프론트는 끝났습니다. 백엔드 엔드포인트 대기 — 위 "장소 수정·삭제" 참고 |

## 백엔드·AI 협의 중

**1. 모아쓰기 요청 형식** — 확정됐습니다. `daily_record_id`(하루) / `start_date`+`end_date`(기간) /
`dates`(불연속) 배타, 최대 31일(`MAX_BLOG_PERIOD_DAYS`), 기록 없는 날은 백엔드가 제외,
횟수는 1회 차감, 같은 기간 생성 **진행 중**일 때만 409.

**2. 타임존** — 끝났습니다. analyze `?timezone=`이 `daily_records.timezone`에 저장되고
`day_bounds()`가 그 값으로 하루를 자릅니다. 타임라인은 장소별 `utc_offset_minutes`로
현지 시각을 그립니다. GPS 업로드 body의 `timezone`은 여전히 **받지만 쓰지 않습니다** —
하루의 tz는 analyze 쪽으로 충분합니다.

**3. 사진 썸네일** — 끝났습니다. `TimelinePlace.thumbnails`가 내려오고 `PostCard`가
카드에 축소본을, 확대 보기에 원본(`photos`)을 씁니다. 썸네일이 없는 기존 사진은
`thumbnails?.[0] ?? photos?.[0]`으로 원본에 폴백합니다.
