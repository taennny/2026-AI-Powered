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
    │   └── journal-list/index.tsx   # 검색 + FlatList (무한 스크롤)
    ├── kakao-link.tsx               # 카카오 연동 딥링크 폴백 (아래 "카카오 연동" 참고)
    ├── write/index.tsx              # 프롬프트 입력 → AI 생성
    ├── write-preview/index.tsx      # 미리보기/저장 (리스트에서 진입 시 상세 조회)
    └── settings/                    # index, account, subscription, theme, records
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
          → login.tsx가 반환 URL을 파싱해 저장 후 홈
          (kakao-login.tsx는 딥링크가 라우터로 흘러들어올 때의 폴백)
```

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
| `GET /api/v1/blogs` | `fetchBlogs` | `hooks/useJournalList.ts` (`q`·`page`·`size` 사용) |
| `POST /api/v1/gps/logs` | `uploadGpsLogs` | `tasks/gpsTask.ts` (body에 `timezone` 동봉) |
| `POST /api/v1/gps/logs/{date}/analyze` | `analyzeGpsLogs` | `tasks/gpsTask.ts` (`?timezone=`) |
| `POST /api/v1/blog/generate` | `generateBlog` | `write/index.tsx` |
| `GET /api/v1/blogs/{id}/status` | `fetchBlogGenerationStatus` | `waitForBlogGeneration` 폴링 |
| `GET /api/v1/blog/{id}` | `fetchBlogDetail` | `write-preview/index.tsx` |
| `PUT /api/v1/blog/{id}` | `updateBlog` | `write-preview/index.tsx` |
| `GET /api/v1/subscriptions/me` | `fetchSubscription` | `settings/subscription`, `settings/theme` |
| `PUT /api/v1/subscriptions/me` | `subscribePremium`, `cancelSubscription` | `settings/subscription` (인앱결제 도입 시 잠길 예정) |
| `POST /api/v1/photos/upload` | `uploadPhoto` | `utils/photoSync.ts` (타임라인 카드 사진) |

백엔드에는 있으나 **프론트가 아직 안 쓰는** 엔드포인트:
`DELETE /api/v1/blog/{id}`(글 삭제 — 204, 소프트 삭제),
`POST /api/v1/blog/{id}/publish`(발행 — 공개 기능이 생기면 붙일 자리),
`POST /api/v1/webhooks/revenuecat`(결제 웹훅 — 앱이 부르는 게 아니라 RevenueCat이 부릅니다).

외부 링크: 문의하기는 카카오 오픈채팅(`settings/index.tsx`의 `SUPPORT_CHAT_URL`)으로,
`Linking.openURL` 전에 확인 다이얼로그를 띄웁니다.

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

**탭 전환 캐시** — 탭 레이아웃이 `Slot`이라 홈↔저널을 오갈 때마다 화면이 언마운트됩니다.
`useCalendar`·`useJournalList`가 마지막 성공 결과를 모듈에 남겨 리마운트 시 즉시 보여주고,
갱신은 뒤에서 진행합니다(stale-while-revalidate). 키(연-월 / 날짜)가 다르면 쓰지 않고,
검색 결과는 캐시하지 않으며, 조회 실패 시 무효화합니다.
**로그아웃 시 `(main)/_layout`이 비웁니다** — 다음 계정이 물려받으면 안 됩니다.

**사진 자동 업로드**(`utils/photoSync.ts`) — 앱 진입·복귀 시 오늘, 캘린더에서 날짜를 고르면
그 날짜. 와이파이일 때만, 날짜별 5분 간격, 회당 20장, 스크린샷 제외.
과거를 한꺼번에 훑지 않습니다 — 사진 한 장이 3~5MB라 한 달치면 수 GB입니다.

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

> **SDK는 아직 설치 전입니다.** App Store Connect에 상품을 등록해야 하고, 그러려면
> Apple Developer Program($99/년)이 필요합니다.

계정이 준비되면 할 일 (SDK 호출 한 줄이 아닙니다):

| | 내용 |
|---|---|
| 상품 등록 | App Store Connect에 월간·연간 두 개 |
| SDK 설치 | `react-native-purchases` (네이티브 → 재빌드) |
| `purchases.ts` | `TODO(결제)` 자리에 `Purchases.logIn` / `logOut` |
| 가격 표시 | 지금은 `₩7,500` 하드코딩. `getOfferings()`가 주는 실제 가격으로 — 지역·환율에 따라 달라집니다 |
| 결제 호출 | `Purchases.purchasePackage()` → 성공 시 `refreshUntilChanged(false)` |
| 해지 경로 | 지금은 우리 서버에 `PUT`. 실제 구독은 앱스토어에 있으므로 구독 관리 화면(`constants/store.ts`의 `APP_STORE_SUBSCRIPTIONS_URL`)으로 보내야 합니다 |

> **탈퇴해도 앱스토어 구독은 살아 있습니다.** 우리 서버의 구독 행을 지워도 결제는
> Apple에 남아 탈퇴한 사람에게 계속 청구됩니다. 우리가 대신 해지할 수 없으므로
> `settings/account`의 탈퇴 확인 다이얼로그가 프리미엄일 때 이를 알리고
> 구독 관리 화면으로 가는 버튼을 함께 띄웁니다. 앱스토어 심사에서도 보는 항목입니다.

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
store/subscriptionStore.ts  plan, billingCycle, isActive, expiresAt, willRenew,
                        hasLoaded, justExpired
                        / isPremium(), refresh, refreshUntilChanged,
                          acknowledgeExpiry, reset
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
hooks/useSubscriptionSync.ts  구독 재조회 시점 (앱 진입 + AppState 복귀) + 만료 안내
hooks/useJournalList.ts   저널 목록 — 서버 검색(디바운스) + 페이지네이션
hooks/useDailyAnalyze.ts  앱 진입·복귀 시 오늘 analyze → 성공 시 requestRefresh()
hooks/usePhotoSync.ts     앱 진입·복귀 시 오늘 사진 자동 업로드 (과거는 useCalendar가 고른 날짜만)
utils/timezone.ts         getDeviceTimeZone() — 서버로 보낼 IANA tz
utils/analyzeSchedule.ts  analyze 호출 시점 (위 "데이터 재조회 정책" 참고)
utils/photoSync.ts        그 날짜 사진 스캔 → 안 올린 것만 업로드
                          (날짜별 5분 간격, 와이파이일 때만, 스크린샷 제외, 회당 20장)
utils/subscriptionStorage.ts  직전 프리미엄 여부 (만료 안내 전용, 판정에 쓰지 않음)
services/purchases.ts     결제 SDK에 user_id 알림 (SDK 설치 전, 배선만)
utils/blogGenerationError.ts  글 생성 실패를 사용자 문구로 (429는 reset_at까지 읽음)
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
| `__tests__/kakao.test.ts` | `constants/kakao.ts` | base URL 끝 슬래시 제거(카카오는 redirect_uri를 문자 단위로 비교), 앱 딥링크와 백엔드 콜백 구분, 로그인·연동 딥링크 분리 |
| `__tests__/photoSync.test.ts` | `utils/photoSync.ts` | 논리적 하루 범위, 스크린샷 제외, ph:// → localUri, 중복 방지, 실패 시 재시도, 와이파이 게이트, 날짜별 간격 가드, 로그아웃 시 기록 삭제 |
| `__tests__/gpsTask.test.ts` | `tasks/gpsTask.ts` | 좌표 변환, 업로드 실패 시 분석으로 안 넘어감, 분석은 스케줄러에 위임 |
| `__tests__/analyzeSchedule.test.ts` | `utils/analyzeSchedule.ts` | 1시간 주기 가드, 날짜 넘어감 감지, 실패 시 기준 날짜 미갱신(재시도), 백그라운드·포그라운드가 시각 공유 |
| `__tests__/blogApi.test.ts` | `waitForBlogGeneration` | completed/failed 분기, **15회(37.5초) 타임아웃 상한** |
| `__tests__/staticMapUrl.test.ts` | `utils/staticMapUrl.ts` | 키 없으면 null, 장소 0/1/N개별 center·zoom, 미리보기와 저장본이 같은 시야 |
| `__tests__/authStore.test.ts` | `authStore` + `tokenStorage` + `onboardingStorage` | 토큰을 store에 복제하지 않음, `clearAuth`와 `logout`의 차이, `initialize` 복원 |
| `__tests__/subscriptionStore.test.ts` | `subscriptionStore` | 조회 실패 시 free 강등, 만료 판정, 프리미엄 테마 basic 복귀, 해지 예약(`willRenew`)은 판정에 넣지 않음, 결제 후 재조회 재시도, 결제 주기 반영, 만료 안내(앱 재시작 후에도 감지·조회 실패는 만료 아님·로그아웃 시 기록 삭제) |
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

> 백엔드도 `daily_records.timezone` 컬럼과 tz 기반 시각 변환을 반영했습니다.
> 다만 **그 컬럼에 값을 채우는 것(analyze 경로)은 아직입니다.** 값이 비어 있으면
> `Asia/Seoul`로 폴백하고, 하루 경계도 여전히 KST 자정이라
> **새벽 0~4시에 찍힌 GPS는 어느 날짜에도 들어가지 않습니다.**

### 남은 미결

1. 4시 경계를 **표시**에도 적용할지 — 새벽 3시 기록을 `3:00AM`으로 볼지 `27:00`으로 볼지
2. 여행 중 tz가 바뀌는 날 — `daily_records.timezone`이 한 칼럼이라 하루에 tz가 하나뿐입니다.
   비행기 탄 날이 어긋납니다. 출발지 / 도착지 / 로그별 중 택일
3. EXIF `OffsetTimeOriginal` 우선 사용 — 해외에서 찍은 사진이 KST 고정이라 어긋납니다

> 구독 횟수 리셋은 **월요일 새벽 4시(KST)** 로 정해졌습니다. 무료 주 3회.

## 알려진 문제

| 문제 | 위치 | 영향 | 담당 |
|---|---|---|---|
| **비밀번호 재설정이 껍데기** | `backend/app/api/v1/auth.py:78-89` | 두 엔드포인트가 아무 일도 안 하고 성공 응답만 반환합니다. 이메일도 안 나가고 비밀번호도 안 바뀌는데 앱에는 성공으로 보여, 비밀번호를 잊으면 계정 복구가 불가능합니다 | 백엔드 |
| **연동 URL을 리다이렉트로 준다** | `backend/app/api/v1/auth.py` `kakao_link_start` | `RedirectResponse` 대신 `{"authorize_url": ...}` JSON이어야 합니다. 이 엔드포인트는 `Authorization` 헤더가 필요한데 앱은 브라우저로 여는 구조라 지금은 401입니다. 프론트는 JSON을 가정해 배선을 끝냈습니다 | 백엔드 |
| 카카오 로그인 시 이메일 중복 | `services/auth.py:76` | `social_id`로만 찾고 없으면 새로 만드는데 `users.email`이 unique라, 같은 이메일로 가입한 사람이 카카오로 로그인하면 IntegrityError가 납니다 | 백엔드 |
| `daily_records.timezone` 값이 안 채워짐 | analyze 경로 | 컬럼은 생겼지만 비어 있어 `Asia/Seoul` 폴백으로 동작합니다. 하루 경계도 KST 자정이라 **새벽 0~4시 GPS가 유실**됩니다 | 백엔드(analyze 담당) |
| 검색어가 미리보기 밖에 있으면 안 보임 | `backend/app/api/v1/blog.py:50` | `summary`가 `content[:100]` 고정이라, 본문 200자 지점이 검색돼도 카드에서 확인할 수 없습니다 | 백엔드 |
| AI 장소 매칭이 카테고리 순서에 의존 | `ai/server/modules/gps.py` | 거리 비교 없이 먼저 조회한 카테고리가 이깁니다. 카페에 있어도 300m 안 음식점으로 기록됩니다. 조회 카테고리도 4종뿐이라 병원·학교·마트 등은 "알 수 없음" | AI(강태윤) |
| AI 생성 폴링이 37.5초에서 끊김 | `blogApi.ts:78` | 실제로는 성공했는데 "생성 실패"로 표시 | 프론트(글쓰기) |
| 글 생성 후 캔슬·뒤로가기해도 저장됨 | `write-preview` | 사용자가 버린 글이 쌓입니다 | 프론트(글쓰기) |
| 날짜 비교가 인덱스를 못 탐 | `calendar.py`, `ai.py` | `func.date(func.timezone(...))`로 컬럼을 감쌌습니다 | 백엔드 |

## 미구현 / TODO

| 항목 | 위치 | 비고 |
|---|---|---|
| **인앱결제** | `settings/subscription` | 배선(사용자 식별·`will_renew`·재조회 재시도)은 끝났습니다. 남은 작업은 위 "결제" 섹션의 표 참고. **Apple Developer Program($99/년)이 전제입니다** |
| **모아쓰기(여러 날 묶어쓰기)** | 캘린더 + `write` | 캘린더 다중 선택 → "N일 선택됨 · 글쓰기". **요청 형식이 백엔드·AI와 협의 중**이라 대기 중입니다 (배열/범위, 개수 제한, 빈 날짜 처리, 횟수 차감 규칙) |
| 리포트 | — | 와이어프레임 대기 |
| 글 삭제 UI | 저널 | `DELETE /api/v1/blog/{id}` 준비됨(204, 소프트 삭제). "삭제해도 생성 횟수는 돌아오지 않습니다" 안내 필요 | 
| 사진 모아보기 | `settings/records` | 다른 담당자 구현 중. 설정 > 기록 화면에 붙일 자리를 만들어 뒀습니다 |
| 개인정보처리방침 | `settings/index.tsx` | 링크가 비어 있습니다. **앱스토어 심사 필수** — 문서를 쓰고 공개 URL(Notion 게시 등)을 만들어야 합니다. 위치 상시 수집·사진 업로드가 있어 수집 항목을 꼼꼼히 적어야 합니다 |
| 남은 생성 횟수 표시 | 글쓰기 | 지금은 429가 떠야만 `used/limit`을 알 수 있습니다. `GET /subscriptions/me`에 넣어주면 "이번 주 1/3" 안내가 가능합니다 |
| 카카오 첫 가입자 닉네임 | `(auth)/login.tsx:107` | 백엔드는 카카오 `properties.nickname`을 받아 쓰고 **못 받을 때만** `카카오유저1234`로 폴백합니다(`services/auth.py:88`) — 고정이 아닙니다. 먼저 볼 것은 **카카오 콘솔의 프로필 정보 동의항목**. 화면을 만들려면 닉네임 수정 API(`PATCH /me` 부재)가 전제이고, 지금은 닉네임이 앱 어디에도 안 보여 우선순위가 낮습니다 |
| PostCard 탭 동작 미정 | `PostCard.tsx` | `TimelinePlace`에 `blogId`가 없어 저널로 못 보냅니다. 사진 뷰어 / 장소 상세 / 장소명 수정 중 결정 필요 |

## 백엔드·AI 협의 중

**1. 카카오 로그인/연동 흐름** — 지금 `kakao_login`은 `social_id`로만 사용자를 찾고 없으면
새로 만듭니다. 그래서 (a) 이메일로 가입한 사람이 연동을 시도하면 별개 계정이 생기고,
(b) 같은 이메일이면 unique 제약에 걸립니다.
`social_id`로 못 찾았을 때 **email로도 찾아 기존 계정에 붙이면** 두 문제가 함께 풀리고,
"카카오로 한 번 로그인하면 자동 연동"이 됩니다.
`/auth/kakao/link`(state 기반)는 이미 들어왔지만 **로그인 경로의 이메일 중복은 그대로**라,
사용자가 설정 > 계정에서 연동을 거쳐야만 계정이 합쳐집니다.

**2. 모아쓰기 요청 형식** — 배열인지 범위인지, 개수 제한, 기록 없는 날 처리,
생성 횟수 차감 규칙(1회), 무료 사용자 허용 여부. 정해지면 프론트가 다중 선택 UI를 붙입니다.

**3. 타임존 값 채우기** — 컬럼은 있으나 analyze가 값을 넣지 않습니다.
프론트는 GPS 업로드 body와 analyze 쿼리로 이미 보내고 있어, 받아서 저장하고
하루 경계를 그 tz의 새벽 4시로 바꾸면 켜집니다.
