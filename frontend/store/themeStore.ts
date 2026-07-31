/** 활성 테마 상태 — _layout.tsx 루트 View에 themeVars를 적용해 전역 색상을 전환한다 */

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

  setTheme: id => {
    set({themeId: id, themeVars: THEMES[id]});
    AsyncStorage.setItem(THEME_KEY, id).catch(() => {});
  },

  initialize: async () => {
    const saved = await AsyncStorage.getItem(THEME_KEY);
    if (saved && VALID_THEMES.includes(saved as ThemeId)) {
      set({themeId: saved as ThemeId, themeVars: THEMES[saved as ThemeId]});
    }
  },
}));
