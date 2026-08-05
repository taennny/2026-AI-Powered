import {useEffect} from 'react';
import {Stack} from 'expo-router';
import {router} from 'expo-router';

import {useAuthStore} from '@/store/authStore';
import {useLocationPermissionGuard} from '@/hooks/usePermissions';
import {stopGpsTracking} from '@/hooks/useGpsTracking';

export default function MainLayout() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  useLocationPermissionGuard();

  useEffect(() => {
    if (!isAuthenticated) {
      // 로그아웃·회원탈퇴·토큰 만료가 모두 여기를 지난다.
      // 백그라운드 태스크는 화면이 사라져도 살아남으므로 명시적으로 꺼야 한다 —
      // 안 그러면 로그아웃한 사용자의 위치를 계속 수집한다.
      void stopGpsTracking();
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated]);

  return <Stack screenOptions={{headerShown: false}} />;
}
