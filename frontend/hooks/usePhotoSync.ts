import {useEffect} from 'react';
import {AppState} from 'react-native';

import {useTimelineStore} from '@/store/timelineStore';
import {syncPhotosForDate} from '@/utils/photoSync';
import {logicalToday, toDateKey} from '@/utils/formatDate';

/**
 * 앱 진입·포그라운드 복귀 시 **오늘** 찍은 사진을 서버로 올린다.
 *
 * 복귀 시점이 특히 중요하다 — 사용자는 보통 카메라 앱으로 나갔다가 돌아온다.
 * 실제로 올린 게 있을 때만 `requestRefresh()`로 타임라인을 다시 받아
 * 새 사진이 카드에 뜨게 한다.
 *
 * 과거 날짜는 여기서 훑지 않는다. 캘린더에서 그 날짜를 골랐을 때
 * `useCalendar`가 올린다 — 보지도 않는 날의 사진까지 올릴 이유가 없다.
 */
export function usePhotoSync() {
  useEffect(() => {
    let mounted = true;

    const run = () => {
      syncPhotosForDate(toDateKey(logicalToday())).then(uploaded => {
        if (uploaded > 0 && mounted) {
          useTimelineStore.getState().requestRefresh();
        }
      });
    };

    run();

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') run();
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
}
