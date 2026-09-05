import {useEffect, useRef, useState} from 'react';
import {Alert, Animated, Easing, TouchableOpacity} from 'react-native';
import {Ionicons} from '@expo/vector-icons';

import {useTimelineStore} from '@/store/timelineStore';
import {analyzeNow} from '@/utils/analyzeSchedule';
import {syncPhotosForDate} from '@/utils/photoSync';
import {logicalToday, toDateKey} from '@/utils/formatDate';
import {
  describeAnalyzeError,
  type AnalyzeErrorInfo,
} from '@/utils/analyzeError';

/**
 * 재조회만으로는 부족하다 — 장소를 만드는 건 analyze이고, 그게 안 돌았으면
 * 다시 받아와도 빈 화면이다. 그래서 분석을 강제로 돌린 뒤 화면을 갱신한다.
 */
export default function RefreshButton() {
  const [isRunning, setIsRunning] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isRunning) {
      spin.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();

    return () => animation.stop();
  }, [isRunning, spin]);

  const handlePress = async () => {
    if (isRunning) return;
    setIsRunning(true);

    let failure: AnalyzeErrorInfo | null = null;

    try {
      // 사진을 먼저 올려야 analyze가 그 사진을 장소에 잇는다
      await syncPhotosForDate(
        toDateKey(logicalToday()),
        Date.now(),
        true,
      ).catch(() => 0);
      await analyzeNow();
    } catch (error) {
      failure = describeAnalyzeError(error);
    } finally {
      setIsRunning(false);
    }

    // 실패해도 갱신한다 — 앱이 먼저 끊었을 뿐 서버는 저장했을 수 있다
    useTimelineStore.getState().requestRefresh();

    if (failure) {
      Alert.alert(failure.title, failure.message);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={isRunning}
      activeOpacity={0.6}
      className="p-1 mr-3"
      accessibilityLabel="기록 새로고침"
    >
      <Animated.View
        style={{
          transform: [
            {
              rotate: spin.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg'],
              }),
            },
          ],
        }}
      >
        {/* 옆 햄버거의 bg-muted와 같은 색 (text-muted만 정적 hex다) */}
        <Ionicons name="refresh" size={22} color="#CCCCCC" />
      </Animated.View>
    </TouchableOpacity>
  );
}
