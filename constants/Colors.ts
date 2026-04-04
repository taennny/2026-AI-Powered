/**
 * @file constants/Colors.ts
 * @description 앱 전역 색상 토큰
 */

export const Colors = {
  // Teal brand palette (light → dark)
  tealBg: '#E6F0F1',     // 시트 배경
  teal: '#D8E6E8',       // 바, 탭, 테두리
  tealDark: '#A0B4B8',   // 드래그 핸들
  tealAccent: '#7BBFD4', // 선택 날짜, 이벤트 dot

  // Text
  textPrimary: '#1a1a1a',
  textMedium: '#374151',
  textSecondary: '#6b7280',
  textTertiary: '#9ca3af',

  // Surfaces
  white: '#FFFFFF',
  surface: '#F6F6F6',

  // Borders
  borderLight: '#e5e7eb',
} as const;
