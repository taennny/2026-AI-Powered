/**
 * @file constants/Colors.ts — 기본 테마 색상 상수
 *
 * NativeWind 클래스명으로 표현 불가한 prop 값에서만 사용:
 *   - TextInput placeholderTextColor
 *   - Ionicons color prop
 *
 * 컴포넌트 스타일은 NativeWind 클래스 사용 (tailwind.config.js 참고)
 * 테마 전환은 store/themeStore.ts + constants/themes.ts 참고
 */

export const Colors = {
  tealBg:        '#E6F0F1',
  teal:          '#D8E6E8',
  tealDark:      '#A0B4B8',
  tealAccent:    '#7BBFD4',
  textPrimary:   '#191F28',
  textMedium:    '#374151',
  textSecondary: '#6b7280',
  textTertiary:  '#9ca3af',
  white:         '#FFFFFF',
  surface:       '#F6F6F6',
  borderLight:   '#e5e7eb',
} as const;
