import {useEffect} from 'react';
import {Alert, AppState} from 'react-native';
import {router} from 'expo-router';

import {useSubscriptionStore} from '@/store/subscriptionStore';

/**
 * 구독 상태를 다시 받아오는 시점을 한 곳에 모은다 — (main) 레이아웃에 한 번만 마운트한다.
 *
 * - 앱 진입
 * - 포그라운드 복귀: 인앱결제는 시스템 다이얼로그라 앱 밖에서 완료될 수 있고,
 *   만료도 앱이 떠 있는 동안 지날 수 있다
 *
 * 결제·해지 직후는 그 화면이 직접 refresh()를 부른다 (서버 응답을 받고 나서).
 *
 * 만료 안내도 여기서 띄운다. 만료를 알아채는 곳이 refresh() 하나뿐이라
 * 화면마다 흩어놓을 이유가 없다.
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

    // 먼저 끄고 띄운다 — 복귀할 때마다 refresh()가 도는데, 알림을 닫기 전에
    // 또 켜지면 같은 안내가 쌓인다
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
