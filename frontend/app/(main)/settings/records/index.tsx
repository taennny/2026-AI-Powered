import {View, Text, TouchableOpacity, Switch} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';

import {useSettingsStore} from '@/store/settingsStore';
import {useThemeColors} from '@/hooks/useThemeColors';

export default function RecordsSettingsScreen() {
  const tc = useThemeColors();
  const isTrackingEnabled = useSettingsStore(s => s.isTrackingEnabled);
  const setTrackingEnabled = useSettingsStore(s => s.setTrackingEnabled);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-surface">
      <View className="flex-row items-center px-5 py-3">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <Text className="text-2xl font-normal text-muted">{'<'}</Text>
        </TouchableOpacity>
      </View>

      <View className="px-6 pb-4">
        <Text className="text-[36px] font-extrabold text-primary">기록</Text>
      </View>

      <View className="flex-1">
        <View
          className="absolute top-10 bottom-[50px] w-[0.7px] bg-primary"
          style={{left: '70%'}}
        />

        <View className="px-6 pt-7 gap-y-8">
          <View className="gap-y-2">
            <View className="flex-row items-center justify-between pr-[34%]">
              <Text className="text-[15px] text-primary">위치 기록</Text>
              <Switch
                value={isTrackingEnabled}
                onValueChange={value => void setTrackingEnabled(value)}
                trackColor={{true: tc.tealAccent}}
              />
              <TouchableOpacity
  activeOpacity={0.7}
  onPress={() => router.push('/(main)/(tabs)/photo-folder')}
  className="pt-2"
>
  <Text className="text-[15px] text-primary">사진 모아보기</Text>
  <Text className="text-[13px] leading-[19px] text-secondary mt-2 pr-[32%]">
    타임라인에 기록된 사진을 한곳에서 확인할 수 있어요.
  </Text>
</TouchableOpacity>
            </View>

            {/* 끄면 그날 타임라인이 통째로 비게 되므로 결과를 분명히 알린다 */}
            <Text className="text-[13px] leading-[19px] text-secondary pr-[32%]">
              {isTrackingEnabled
                ? '걸어다닌 곳을 자동으로 기록해 하루 타임라인을 만들어요.'
                : '지금은 위치를 기록하지 않아요. 꺼둔 동안 타임라인은 비게 됩니다.'}
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
