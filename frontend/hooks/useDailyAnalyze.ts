import {useEffect} from 'react';
import {AppState} from 'react-native';

import {useTimelineStore} from '@/store/timelineStore';
import {analyzeOnForeground} from '@/utils/analyzeSchedule';

/**
 * 앱 진입·포그라운드 복귀 시 오늘을 한 번 분석한다.
 *
 * 분석이 실제로 돌았을 때만 `requestRefresh()`로 재조회를 태운다.
 * 이렇게 하면 "분석 → 조회" 순서가 저절로 맞는다 —
 * `useCalendar`가 `refreshKey`를 구독하고 있어서 새 장소가 바로 화면에 뜬다.
 */
export function useDailyAnalyze() {
  useEffect(() => {
    let mounted = true;

    const run = () => {
      analyzeOnForeground().then(analyzed => {
        if (analyzed && mounted) {
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
