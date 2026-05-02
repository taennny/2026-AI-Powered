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
├── _layout.tsx                  # 루트 레이아웃: 폰트 로드, 스플래시 스크린 관리
└── (main)/
    ├── (tabs)/
    │   ├── _layout.tsx          # 탭 공통 레이아웃: Header + SectionTabs + Slot + Footer
    │   ├── home/index.tsx       # Index 탭 화면 (Calendar + BottomSheet)
    │   └── journal-list/index.tsx  # Journal List 탭 화면 (검색 바 + FlatList)
    ├── write/index.tsx          # 글쓰기 화면 (탭 레이아웃 미적용)
    ├── write-preview/index.tsx  # 작성 미리보기 화면
    └── journal-detail/index.tsx # 저널 상세 화면
```

### 탭 네비게이션 패턴

`(tabs)/_layout.tsx`는 expo-router의 `<Slot />`을 사용해 `home`과 `journal-list` 두 화면 간 전환을 처리합니다. 탭 전환은 `SectionTabs` 컴포넌트에서 `router.replace()`로 구현되며, 실제 네이티브 탭바 대신 커스텀 탭 UI를 사용합니다. `HomeFooter`는 `usePathname()`으로 경로를 감지해 `home`에서만 렌더링합니다.

### API 레이어

모든 API 호출은 `utils/api.ts`의 axios 인스턴스를 통해 이루어집니다.

```
utils/api.ts              # axios 인스턴스 (baseURL: EXPO_PUBLIC_API_BASE_URL)
services/calendarApi.ts   # fetchCalendarMonth, fetchTimeline
services/blogApi.ts       # fetchBlogs (q, date, page, size 파라미터)
```

**API 폴백 패턴**: 각 화면은 API 실패 시 `constants/dummyData.ts`의 더미 데이터로 폴백합니다. `EXPO_PUBLIC_API_BASE_URL`을 설정하면 실제 API로 전환됩니다 (기본값: `http://localhost:8000`).

### 현재 연결된 API 엔드포인트

| 엔드포인트 | 함수 | 사용처 |
|---|---|---|
| `GET /api/v1/calendar/{year}/{month}` | `fetchCalendarMonth` | `home/index.tsx` — 월 변경 시 |
| `GET /api/v1/calendar/{date}/timeline` | `fetchTimeline` | `home/index.tsx` — 날짜 선택 시 |
| `GET /api/v1/blogs` | `fetchBlogs` | `journal-list/index.tsx` — 목록·검색·페이지 |

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

BottomSheet는 PanResponder로 3단계 스냅 포인트를 구현합니다:
- `0` — expanded (전체 화면)
- `sheetHeight - peekHeight` — peek (캘린더 아래 절반)
- `sheetHeight - 30` — handleOnly (핸들만 노출)

translateY가 `sheetHeight * 0.45` 미만일 때 MapPreview가 페이드인됩니다 (`isMapMounted` + `mapOpacity` 패턴으로 마운트/언마운트 관리).

`viewDate`는 `home/index.tsx`에서 관리하며 Calendar 컴포넌트에 prop으로 전달합니다. 월이 바뀌면 `fetchCalendarMonth`를 호출하고, 날짜를 선택하면 `fetchTimeline`을 호출합니다.

### 저널 리스트 패턴

`journal-list/index.tsx`는 FlatList + 무한스크롤 + 서버사이드 검색으로 구현됩니다:
- 초기 로드: `useEffect`에서 `fetchBlogs()` 호출
- 검색: `TextInput` 변경 → 300ms 디바운스 → `fetchBlogs({q})` 첫 페이지 재조회
- 무한스크롤: `onEndReached` → 다음 페이지 append
- 검색창: 아이콘 탭 → `Animated.spring`으로 좌측 확장, X 탭 → 축소

### 더미 데이터 (`constants/dummyData.ts`)

API 연결 전까지 폴백 데이터를 관리합니다. 타입 정의도 이 파일에서 export합니다:
- `CalendarDay`, `CalendarMonth`, `DUMMY_CALENDAR`
- `TimelinePlace`, `TimelineData`, `DUMMY_TIMELINE`
- `JournalData`, `BlogsResponse`, `DUMMY_JOURNALS`

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

### 상태 관리

Zustand를 사용합니다. 현재 auth 스토어(`authStore`)가 계획 중이나 미구현 상태입니다. `selectedDate`는 현재 `home/index.tsx` 로컬 state로 관리되며, 타 화면과 공유가 필요해지면 zustand store로 전환 예정입니다.

### 미구현 / TODO 항목

- `app/_layout.tsx`: 인증 토큰 기반 `(auth)` / `(main)` 분기 처리 미연결
- `app/_layout.tsx`: `usePermissions` 훅 연결 (위치 권한 요청) 미연결
- `hooks/useCalendar.ts`: 미구현 상태
- `components/journal/SearchBar.tsx`: 미사용 빈 파일 (검색 바는 `journal-list/index.tsx`에 인라인)
- Kakao Static Map API: `.env`의 `EXPO_PUBLIC_KAKAO_REST_API_KEY` 미설정 시 placeholder 표시
- `utils/api.ts`: 인증 토큰 인터셉터 미연결 (로그인 구현 시 추가)
- `GET /api/v1/blog/{blog_id}`: journal-detail 화면 구현 시 연결 예정
- HomeFooter `total_distance`: 타임라인 API 응답 연결 미완
