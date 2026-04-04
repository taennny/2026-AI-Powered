# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

Roame은 위치 기반 이벤트 탐색 앱의 React Native (Expo) 프론트엔드입니다. 걷기 기반의 일상 기록 및 이벤트 조회 기능을 제공합니다.

## 주요 커맨드

```bash
npm install          # 의존성 설치
npm run start        # Expo 개발 서버 시작
npm run ios          # iOS 시뮬레이터 실행
npm run android      # Android 에뮬레이터 실행
npm run lint         # ESLint 검사
npm run lint:fix     # ESLint 자동 수정
npm run format       # Prettier 포맷팅
```

## 아키텍처

### 라우팅 구조 (expo-router 파일 기반 라우팅)

```
app/
├── _layout.tsx                  # 루트 레이아웃: 폰트 로드, 스플래시 스크린 관리
└── (main)/
    ├── (tabs)/
    │   ├── _layout.tsx          # 탭 공통 레이아웃: Header + SectionTabs + Slot + Footer
    │   ├── home/index.tsx       # Index 탭 화면
    │   └── journal-list/index.tsx  # Journal List 탭 화면
    ├── write/index.tsx          # 글쓰기 화면 (탭 레이아웃 미적용)
    ├── write-preview/index.tsx  # 작성 미리보기 화면
    └── journal-detail/index.tsx # 저널 상세 화면
```

### 탭 네비게이션 패턴

`(tabs)/_layout.tsx`는 expo-router의 `<Slot />`을 사용해 `home`과 `journal-list` 두 화면 간 전환을 처리합니다. 탭 전환은 `SectionTabs` 컴포넌트에서 `router.replace()`로 구현되며, 실제 네이티브 탭바 대신 커스텀 탭 UI를 사용합니다. `write`, `journal-detail` 등 (tabs) 밖 화면에는 공통 레이아웃이 적용되지 않습니다.

### 스타일링

NativeWind v4 (Tailwind CSS for React Native)를 사용합니다. 레이아웃에는 Tailwind 클래스, 세부 스타일(색상, 반경 등)에는 인라인 `style` prop을 혼용하는 패턴이 있습니다.

### 경로 별칭

`@/`는 프로젝트 루트를 가리킵니다 (`tsconfig.json` 경로 설정). 예: `@/components/home/HomeHeader`.

### 상태 관리

Zustand를 사용합니다. 현재 auth 스토어(`authStore`)가 계획 중이나 미구현 상태입니다.

### 미구현 / TODO 항목

- `app/_layout.tsx`: 인증 토큰 기반 `(auth)` / `(main)` 분기 처리 미연결
- `app/_layout.tsx`: `usePermissions` 훅 연결 (위치 권한 요청) 미연결
- `hooks/useCalendar.ts`: 미구현 상태
