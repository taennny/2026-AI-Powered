/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // ─── 테마 토큰 (CSS 변수 → themeStore에서 주입) ───────────────
        // 브랜드 팔레트
        'teal-bg':    'var(--color-teal-bg)',    // bg-teal-bg    시트·화면 배경
        teal:         'var(--color-teal)',        // bg-teal       탭·바·테두리
        'teal-dark':  'var(--color-teal-dark)',   // bg-teal-dark  드래그 핸들
        'teal-accent':'var(--color-teal-accent)', // bg-teal-accent 선택·강조·dot
        // 텍스트
        primary:      'var(--color-primary)',     // text-primary  기본 텍스트·버튼 배경
        medium:       'var(--color-medium)',      // text-medium   서브 텍스트
        secondary:    'var(--color-secondary)',   // text-secondary 보조 텍스트
        tertiary:     'var(--color-tertiary)',    // text-tertiary  힌트·레이블
        // 서피스
        surface:      'var(--color-surface)',     // bg-surface    헤더·푸터·화면 배경
        line:         'var(--color-line)',        // border-line   구분선·테두리
        // ─── 정적 토큰 (테마와 무관) ──────────────────────────────────
        muted:        '#CCCCCC',                 // text-muted    비활성 아이콘·화살표
      },
    },
  },
  plugins: [],
};
