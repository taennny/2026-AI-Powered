/** @file store/themeStore.ts — 활성 테마 상태. _layout.tsx 루트 View에 themeVars를 적용해 전역 색상 전환 */

import {create} from 'zustand';
import {vars} from 'nativewind';
import {THEMES, type ThemeId} from '@/constants/themes';

type ThemeStore = {
  themeId: ThemeId;
  themeVars: ReturnType<typeof vars>;
  setTheme: (id: ThemeId) => void;
};

export const useThemeStore = create<ThemeStore>(set => ({
  themeId: 'basic',
  themeVars: THEMES.basic,
  setTheme: id => set({themeId: id, themeVars: THEMES[id]}),
}));
