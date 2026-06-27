import {useThemeStore} from '@/store/themeStore';
import {THEME_VALUES, type ThemeColors} from '@/constants/themes';

export function useThemeColors(): ThemeColors {
  const themeId = useThemeStore(s => s.themeId);
  return THEME_VALUES[themeId];
}
