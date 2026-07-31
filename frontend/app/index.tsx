/**
 * 앱 진입점 — useBootstrap이 정한 화면으로 이동만 한다.
 * - 토큰 있음 → 온보딩 완료 여부에 따라 /onboarding 또는 홈
 * - 토큰 없음 → /(auth)/login
 */

import {useEffect} from 'react';
import {useRouter} from 'expo-router';
import {View, ActivityIndicator} from 'react-native';

import {useBootstrap} from '@/hooks/useBootstrap';

export default function IndexScreen() {
  const router = useRouter();
  const route = useBootstrap();

  useEffect(() => {
    if (route) {
      router.replace(route);
    }
  }, [route, router]);

  return (
    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      <ActivityIndicator size="large" />
    </View>
  );
}
