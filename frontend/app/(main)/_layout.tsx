import {useEffect} from 'react';
import {Stack} from 'expo-router';
import {router} from 'expo-router';

import {useAuthStore} from '@/store/authStore';
import {useLocationPermissionGuard} from '@/hooks/usePermissions';
import {useSubscriptionSync} from '@/hooks/useSubscriptionSync';
import {useDailyAnalyze} from '@/hooks/useDailyAnalyze';
import {usePhotoSync} from '@/hooks/usePhotoSync';
import {clearCalendarCache} from '@/hooks/useCalendar';
import {clearJournalCache} from '@/hooks/useJournalList';
import {clearPhotoSyncState} from '@/utils/photoSync';
import {stopGpsTracking} from '@/hooks/useGpsTracking';
import {useSubscriptionStore} from '@/store/subscriptionStore';
import {identifyUser, resetIdentifiedUser} from '@/services/purchases';

export default function MainLayout() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  useLocationPermissionGuard();
  useSubscriptionSync();
  // 홈 화면이 아니라 여기에 둔다. 탭 레이아웃이 Slot이라 홈은 탭을 오갈 때마다
  // 리마운트되는데, 거기 두면 탭을 누를 때마다 analyze가 나가 전환이 느려진다
  // (게다가 백엔드가 places를 덮어쓰지 않아 그때마다 장소가 하나씩 늘어난다).
  useDailyAnalyze();
  usePhotoSync();

  useEffect(() => {
    if (isAuthenticated) {
      // 결제 SDK에 지금 사용자를 알린다. 이게 없으면 결제 웹훅이 와도
      // 백엔드가 누구 결제인지 매칭할 수 없다.
      // 로그인 화면이 세 갈래(이메일·카카오 버튼·카카오 딥링크)라
      // 각각에 넣는 대신 인증 상태가 켜지는 한 곳에서 처리한다.
      void identifyUser();
      return;
    }

    // 다음 계정이 이전 사용자의 구독 상태·결제 신원을 물려받으면 안 된다
    useSubscriptionStore.getState().reset();
    resetIdentifiedUser();
    // 같은 이유로 화면 캐시도 비운다 — 남겨두면 다음 계정에 이전 사용자의
    // 캘린더·저널이 잠깐 보인다
    clearCalendarCache();
    clearJournalCache();
    void clearPhotoSyncState();
    // 로그아웃·회원탈퇴·토큰 만료가 모두 여기를 지난다.
    // 백그라운드 태스크는 화면이 사라져도 살아남으므로 명시적으로 꺼야 한다 —
    // 안 그러면 로그아웃한 사용자의 위치를 계속 수집한다.
    void stopGpsTracking();
    router.replace('/(auth)/login');
  }, [isAuthenticated]);

  return <Stack screenOptions={{headerShown: false}} />;
}
