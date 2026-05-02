/**
 * @file app/index.tsx
 * @description 앱 진입점 — 권한 요청 + 인증 토큰 확인 후 화면 분기
 * - 토큰 있음 → /(main)/(tabs)/home
 * - 토큰 없음 → /(auth)/login
 */

import {useEffect} from 'react';
import {useRouter} from 'expo-router';
import {View, ActivityIndicator} from 'react-native';
import {usePermissions} from '@/hooks/usePermissions';
import {useAuthStore} from '@/store/authStore';

export default function IndexScreen() {
  const router = useRouter();
  const {requestAll} = usePermissions();
  const initialize = useAuthStore(s => s.initialize);

  useEffect(() => {
    const bootstrap = async () => {
      await requestAll();
      await initialize();

      const {isAuthenticated} = useAuthStore.getState();
      if (isAuthenticated) {
        router.replace('/(main)/(tabs)/home');
      } else {
        router.replace('/(auth)/login');
      }
    };

    bootstrap();
  }, []);

  return (
    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      <ActivityIndicator size="large" />
    </View>
  );
}
