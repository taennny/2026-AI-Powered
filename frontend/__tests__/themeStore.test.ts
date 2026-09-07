import AsyncStorage from '@react-native-async-storage/async-storage';

import {useThemeStore} from '@/store/themeStore';
import {THEMES} from '@/constants/themes';

describe('themeStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useThemeStore.setState({themeId: 'basic', themeVars: THEMES.basic});
  });

  it('테마를 바꾸면 디스크에도 남는다 — 앱을 껐다 켜도 유지된다', async () => {
    useThemeStore.getState().setTheme('dark');

    expect(useThemeStore.getState().themeId).toBe('dark');
    await expect(AsyncStorage.getItem('themeId')).resolves.toBe('dark');
  });

  it('저장된 테마를 복원한다', async () => {
    await AsyncStorage.setItem('themeId', 'aqua');

    await useThemeStore.getState().initialize();

    expect(useThemeStore.getState().themeId).toBe('aqua');
  });

  // 없는 값이 들어와도 화면이 깨지면 안 된다
  it('저장된 값이 알 수 없는 테마면 무시한다', async () => {
    await AsyncStorage.setItem('themeId', 'neon');

    await useThemeStore.getState().initialize();

    expect(useThemeStore.getState().themeId).toBe('basic');
  });

  // 프리미엄 테마가 다음 계정에 그대로 남으면 안 된다
  it('로그아웃하면 basic으로 돌아가고 디스크에서도 지운다', async () => {
    useThemeStore.getState().setTheme('strawberry');

    useThemeStore.getState().reset();

    expect(useThemeStore.getState().themeId).toBe('basic');
    expect(useThemeStore.getState().themeVars).toEqual(THEMES.basic);
    await expect(AsyncStorage.getItem('themeId')).resolves.toBeNull();
  });

  it('reset 후 initialize해도 basic이다 — 지워진 값을 되살리지 않는다', async () => {
    useThemeStore.getState().setTheme('dark');
    useThemeStore.getState().reset();

    await useThemeStore.getState().initialize();

    expect(useThemeStore.getState().themeId).toBe('basic');
  });
});
