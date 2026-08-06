import {useEffect, useState} from 'react';

import {useAuthStore} from '@/store/authStore';
import {useSettingsStore} from '@/store/settingsStore';
import {isOnboardingDone} from '@/utils/onboardingStorage';

export type BootstrapRoute =
  | '/(main)/(tabs)/home'
  | '/onboarding'
  | '/(auth)/login';

export function useBootstrap(): BootstrapRoute | null {
  const [route, setRoute] = useState<BootstrapRoute | null>(null);
  const initialize = useAuthStore(s => s.initialize);

  useEffect(() => {
    let isActive = true;

    const bootstrap = async () => {
      // 위치 기록 토글도 여기서 복원한다 — 헤더 알림이 이 값을 보고 뜨는데,
      // 권한 흐름까지 기다리면 알림이 늦게 나타난다
      await Promise.all([
        initialize(),
        useSettingsStore.getState().initialize(),
      ]);

      if (!useAuthStore.getState().isAuthenticated) {
        if (isActive) setRoute('/(auth)/login');
        return;
      }

      // GPS 시작은 (main) 진입 시 권한 확보 후 usePermissions가 맡는다.
      // 여기서 부르면 권한 요청 전이라 항상 조용히 실패한다.
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
