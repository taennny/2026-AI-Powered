/**
 * @file store/themeStore.ts — 활성 테마 상태. _layout.tsx 루트 View에 themeVars를 적용해 전역 색상 전환
 *
 * themeId는 AsyncStorage에 저장되어 앱 재시작 후에도 유지됩니다.
 *   테마 변경 → setTheme() (메모리 + 디스크 저장)
 *   앱 시작   → initialize() (디스크 → store 복원, _layout 스플래시 동안 호출)
 */

import {create} from 'zustand';
import {vars} from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {THEMES, type ThemeId} from '@/constants/themes';

const THEME_KEY = 'themeId';
const VALID_THEMES = Object.keys(THEMES) as ThemeId[];

type ThemeStore = {
  themeId: ThemeId;
  themeVars: ReturnType<typeof vars>;
  setTheme: (id: ThemeId) => void;
  initialize: () => Promise<void>;
};

export const useThemeStore = create<ThemeStore>(set => ({
  themeId: 'basic',
  themeVars: THEMES.basic,

  // 테마 전환 + 디스크 저장 (재시작 후 유지)
  setTheme: id => {
    set({themeId: id, themeVars: THEMES[id]});
    AsyncStorage.setItem(THEME_KEY, id).catch(() => {});
  },

  // 앱 시작 시 저장된 테마 복원
  initialize: async () => {
    const saved = await AsyncStorage.getItem(THEME_KEY);
    if (saved && VALID_THEMES.includes(saved as ThemeId)) {
      set({themeId: saved as ThemeId, themeVars: THEMES[saved as ThemeId]});
    }
  },
}));
