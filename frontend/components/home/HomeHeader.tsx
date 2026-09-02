import {View, Text, TouchableOpacity} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';

import {useSettingsStore} from '@/store/settingsStore';
import RefreshButton from '@/components/home/RefreshButton';

/**
 * 위치 기록이 꺼져 있으면 헤더 왼쪽에 계속 띄운다.
 *
 * 잠깐 떴다 사라지는 알림으로는 "껐다는 걸 잊고 하루를 통째로 날리는" 것을
 * 막을 수 없다. 꺼져 있는 동안 상시 보이되, 눈에 거슬리지 않게 작고 연하게.
 */
function TrackingOffNotice() {
  const hasLoaded = useSettingsStore(s => s.hasLoaded);
  const isTrackingEnabled = useSettingsStore(s => s.isTrackingEnabled);

  // 복원 전에는 판단하지 않는다 — 기본값이 '켬'이라 잠깐 잘못 뜰 수 있다
  if (!hasLoaded || isTrackingEnabled) return null;

  return (
    <TouchableOpacity
      onPress={() => router.push('/(main)/settings/records')}
      activeOpacity={0.6}
      className="flex-row items-center gap-x-[9px] py-1"
    >
      {/* 바텀시트 드래그 핸들과 같은 결의 세로 바 */}
      <View className="w-[2.5px] h-[26px] rounded-full bg-teal-dark" />
      <View>
        <Text className="text-[12px] leading-[15px] text-secondary">
          위치 기록이 꺼져 있어요
        </Text>
        <Text className="text-[10px] leading-[13px] text-tertiary">
          설정 &gt; 기록 &gt; 위치 기록
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeHeader() {
  return (
    <SafeAreaView edges={['top']} className="bg-surface">
      {/* 알림이 없을 때도 햄버거가 오른쪽에 붙도록 justify-between + 빈 View */}
      <View className="flex-row items-center justify-between px-5 py-3 bg-surface">
        <TrackingOffNotice />
        <View className="flex-1" />

        <RefreshButton />

        <TouchableOpacity onPress={() => router.push('/(main)/settings')} className="p-1 gap-y-[5px]">
          <View className="w-[22px] h-[1.5px] bg-muted" />
          <View className="w-[22px] h-[1.5px] bg-muted" />
          <View className="w-[22px] h-[1.5px] bg-muted" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
