import {View, Text, TouchableOpacity} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';

import SettingToggle from '@/components/settings/SettingToggle';
import {useSettingsStore} from '@/store/settingsStore';

export default function RecordsSettingsScreen() {
  const isTrackingEnabled = useSettingsStore(s => s.isTrackingEnabled);
  const setTrackingEnabled = useSettingsStore(s => s.setTrackingEnabled);
  const isCellularUploadEnabled = useSettingsStore(
    s => s.isCellularUploadEnabled,
  );
  const setCellularUploadEnabled = useSettingsStore(
    s => s.setCellularUploadEnabled,
  );

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
          <SettingToggle
            label="위치 기록"
            value={isTrackingEnabled}
            onChange={value => void setTrackingEnabled(value)}
            onDescription="걸어다닌 곳을 자동으로 기록해 하루 타임라인을 만들어요."
            offDescription="지금은 위치를 기록하지 않아요. 꺼둔 동안 타임라인은 비게 됩니다."
          />

          <SettingToggle
            label="셀룰러 환경에서 사진 업로드"
            value={isCellularUploadEnabled}
            onChange={value => void setCellularUploadEnabled(value)}
            onDescription="데이터를 켜고 있을 때도 사진이 올라가요. 데이터 요금이 부과될 수 있어요."
            offDescription="와이파이에 연결됐을 때만 사진이 올라가요."
          />

          {/* 온보딩이 "위치 기록으로 하루를 남긴다"를 설명하는 내용이라 이 화면에 둔다 */}
          <View className="gap-y-2">
            <TouchableOpacity
              onPress={() => router.push('/onboarding')}
              activeOpacity={0.6}
              className="pr-[34%]"
            >
              <Text className="text-[15px] text-primary">온보딩 다시 보기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
