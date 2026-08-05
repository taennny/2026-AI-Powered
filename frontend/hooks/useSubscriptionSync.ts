import {useEffect} from 'react';
import {AppState} from 'react-native';

import {useSubscriptionStore} from '@/store/subscriptionStore';

/**
 * 구독 상태를 다시 받아오는 시점을 한 곳에 모은다 — (main) 레이아웃에 한 번만 마운트한다.
 *
 * - 앱 진입
 * - 포그라운드 복귀: 인앱결제는 시스템 다이얼로그라 앱 밖에서 완료될 수 있고,
 *   만료도 앱이 떠 있는 동안 지날 수 있다
 *
 * 결제·해지 직후는 그 화면이 직접 refresh()를 부른다 (서버 응답을 받고 나서).
 */
export function useSubscriptionSync() {
  useEffect(() => {
    const refresh = () => {
      void useSubscriptionStore.getState().refresh();
    };

    refresh();

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });

    return () => subscription.remove();
  }, []);
}
