/**
 * @file app/_layout.tsx
 * @description 앱 전체 루트 레이아웃
 * - 폰트 로드 완료 전까지 스플래시 스크린 유지
 * - 인증 분기 및 권한 요청은 app/index.tsx에서 처리
 * - 하위 라우팅: (auth) 그룹(로그인/회원가입), (main) 그룹(홈/탭/설정)
 */

import '../global.css';
import {Stack} from 'expo-router';
import {useFonts} from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import {useEffect} from 'react';
import {View} from 'react-native';
import {useThemeStore} from '@/store/themeStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // TODO: 추후 커스텀 폰트 추가 시 여기에 등록
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

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
