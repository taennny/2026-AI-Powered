/**
 * 홈 하단 푸터 (글쓰기 버튼)
 * - 체류 장소와 daily_record_id를 모두 확보했을 때만 활성화 (timelineStore)
 */

import {View, Text, TouchableOpacity} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';

import {useTimelineStore} from '@/store/timelineStore';

export default function HomeFooter() {
  const placesCount = useTimelineStore(s => s.placesCount);
  const dailyRecordId = useTimelineStore(s => s.dailyRecordId);
  // 글 생성 API가 daily_record_id를 필수로 요구하므로 확보 전에는 비활성화한다.
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
