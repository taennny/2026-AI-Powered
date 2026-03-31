/**
 * @file app/_layout.tsx
 * @description 앱 최초 진입점 (앱 전체 루트 레이아웃)
 * - 폰트 로드 완료 전까지 스플래시 스크린 유지
 * - 하위 라우팅은 (auth)/_layout.tsx, (main)/_layout.tsx에서 관리
 * - 로드 완료 후 (main)/(tabs)/home 으로 이동 (임시)
 *
 * ## 다음 연결 작업
 * - [ ] 계정 인증 - authStore 토큰 여부에 따라 (auth) / (main) 분기 처리
 * - [ ] 권한 요청 - usePermissions 훅 연결하여 앱 최초 실행 시 권한 요청
 */

import '../global.css';
import {Stack} from 'expo-router';
import {useFonts} from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import {useEffect} from 'react';

// TODO: 인증 연결 시 import 추가
// import { Redirect } from 'expo-router';
// import { useAuthStore } from '@/store/authStore';

// TODO: 권한 요청 연결 시 import 추가
// import { usePermissions } from '@/hooks/usePermissions';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // TODO: 인증 연결 시 토큰 체크 추가
  // const { token } = useAuthStore();

  // TODO: 권한 요청 연결 시 추가
  // const { requestAll } = usePermissions();
  // useEffect(() => { requestAll(); }, []);

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

  // TODO: 인증 연결 시 Redirect 분기 처리

  return <Stack screenOptions={{headerShown: false}} />;
}
