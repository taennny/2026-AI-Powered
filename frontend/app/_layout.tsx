import '../global.css';
import '../tasks/gpsTask';
import {Stack} from 'expo-router';
import {useFonts} from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import {useEffect, useState} from 'react';
import {View} from 'react-native';

import {useThemeStore} from '@/store/themeStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // 저장된 테마 복원 — 스플래시 동안 끝내서 basic으로 깜빡이지 않게
  const initTheme = useThemeStore(s => s.initialize);
  const [themeLoaded, setThemeLoaded] = useState(false);

  useEffect(() => {
    initTheme().finally(() => setThemeLoaded(true));
  }, [initTheme]);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded && themeLoaded) SplashScreen.hideAsync();
  }, [loaded, themeLoaded]);

  if (!loaded || !themeLoaded) return null;

  return <ThemeRoot />;
}

function ThemeRoot() {
  const themeVars = useThemeStore(s => s.themeVars);
  return (
    <View style={[{flex: 1}, themeVars]}>
      <Stack screenOptions={{headerShown: false}} />
    </View>
  );
}
