import {useEffect} from 'react';
import {Alert, AppState} from 'react-native';
import {router} from 'expo-router';

import {useSubscriptionStore} from '@/store/subscriptionStore';

/**
 * 구독 재조회 시점 — 앱 진입 + 포그라운드 복귀. (main)에 한 번만 마운트한다.
 * 결제는 앱 밖(시스템 다이얼로그)에서 끝날 수 있어 복귀 갱신이 필요하다.
 * 만료 안내도 여기서 띄운다 — 만료를 알아채는 곳이 refresh() 하나뿐이라서.
 */
export function useSubscriptionSync() {
  const justExpired = useSubscriptionStore(s => s.justExpired);

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

  useEffect(() => {
    if (!justExpired) return;

    // 먼저 끄고 띄운다 — 안 그러면 복귀할 때마다 안내가 쌓인다
    useSubscriptionStore.getState().acknowledgeExpiry();

    Alert.alert(
      '구독이 만료됐어요',
      '프리미엄 테마는 기본 테마로 돌아갔어요. 다시 구독하면 그대로 이어서 쓸 수 있어요.',
      [
        {text: '나중에', style: 'cancel'},
        {
          text: '구독 보기',
          onPress: () => router.push('/(main)/settings/subscription'),
        },
      ],
    );
  }, [justExpired]);
}
