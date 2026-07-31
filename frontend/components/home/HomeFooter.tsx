import {View, Text, TouchableOpacity} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';

import {useTimelineStore} from '@/store/timelineStore';

export default function HomeFooter() {
  const placesCount = useTimelineStore(s => s.placesCount);
  const dailyRecordId = useTimelineStore(s => s.dailyRecordId);
  const hasTimeline = placesCount > 0 && !!dailyRecordId;

  return (
    <SafeAreaView edges={['bottom']} className="bg-footer">
      <View className="flex-row items-center justify-end px-5 py-3 bg-footer">
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: '/(main)/write',
              params: {dailyRecordId: String(dailyRecordId)},
            })
          }
          disabled={!hasTimeline}
          className={`px-5 py-[10px] rounded-[20px] ${hasTimeline ? 'bg-btn-bg' : 'bg-tertiary opacity-70'}`}
        >
          <Text className="text-btn-text text-[13px] font-semibold tracking-[0.5px]">
            글쓰기
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
