import {useEffect, useState} from 'react';

import {usePermissions} from '@/hooks/usePermissions';
import {useGpsTracking} from '@/hooks/useGpsTracking';
import {useAuthStore} from '@/store/authStore';
import {isOnboardingDone} from '@/utils/onboardingStorage';

export type BootstrapRoute =
  | '/(main)/(tabs)/home'
  | '/onboarding'
  | '/(auth)/login';

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
