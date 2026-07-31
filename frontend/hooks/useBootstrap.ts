/**
 * 앱 시작 시 한 번 수행하는 준비 작업 — 권한 요청 → 토큰 복원 → 진입 화면 결정
 * 화면(app/index.tsx)은 반환된 목적지로 이동만 한다.
 */

import {useEffect, useState} from 'react';

import {usePermissions} from '@/hooks/usePermissions';
import {useGpsTracking} from '@/hooks/useGpsTracking';
import {useAuthStore} from '@/store/authStore';
import {isOnboardingDone} from '@/utils/onboardingStorage';

export type BootstrapRoute =
  | '/(main)/(tabs)/home'
  | '/onboarding'
  | '/(auth)/login';

/** 준비가 끝나기 전에는 null을 반환한다. */
export function useBootstrap(): BootstrapRoute | null {
  const [route, setRoute] = useState<BootstrapRoute | null>(null);
  const {requestAll} = usePermissions();
  const initialize = useAuthStore(s => s.initialize);
  const {start: startGps} = useGpsTracking();

  useEffect(() => {
    let isActive = true;

    const bootstrap = async () => {
      await requestAll();
      await initialize();

      if (!useAuthStore.getState().isAuthenticated) {
        if (isActive) setRoute('/(auth)/login');
        return;
      }

      await startGps();

      const onboardingDone = await isOnboardingDone();
      if (isActive) {
        setRoute(onboardingDone ? '/(main)/(tabs)/home' : '/onboarding');
      }
    };

    bootstrap();

    return () => {
      isActive = false;
    };
    // 마운트 시 1회만 실행 — 의존성이 바뀌어도 재실행하면 안 된다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return route;
}
