import {View, Text, TouchableOpacity} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';

import {useTimelineStore} from '@/store/timelineStore';
import {
  canGenerate,
  isSelecting,
  selectedDateKeys,
  useDateSelectionStore,
} from '@/store/dateSelectionStore';

export default function HomeFooter() {
  const placesCount = useTimelineStore(s => s.placesCount);
  const dailyRecordId = useTimelineStore(s => s.dailyRecordId);

  const selected = useDateSelectionStore(s => s.selected);
  const clearSelection = useDateSelectionStore(s => s.clear);

  const selecting = isSelecting(selected);
  const dateKeys = selectedDateKeys(selected);
  const recordCount = Object.values(selected).filter(Boolean).length;

  const canWrite = selecting
    ? canGenerate(selected)
    : placesCount > 0 && !!dailyRecordId;

  const handleWrite = () => {
    if (selecting) {
      router.push({
        pathname: '/(main)/write',
        params: {dates: dateKeys.join(',')},
      });
      return;
    }

    router.push({
      pathname: '/(main)/write',
      params: {dailyRecordId: String(dailyRecordId)},
    });
  };

  return (
    <SafeAreaView edges={['bottom']} className="bg-footer">
      <View className="flex-row items-center justify-between px-5 py-3 bg-footer">
        {selecting ? (
          <View className="flex-row items-center gap-x-3">
            <Text className="text-[13px] text-primary">
              {dateKeys.length}일 선택됨
              {recordCount < dateKeys.length && (
                <Text className="text-tertiary"> (기록 {recordCount}일)</Text>
              )}
            </Text>
            <TouchableOpacity onPress={clearSelection} activeOpacity={0.6}>
              <Text className="text-[13px] text-tertiary underline">
                선택 해제
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View />
        )}

        <TouchableOpacity
          onPress={handleWrite}
          disabled={!canWrite}
          className={`px-5 py-[10px] rounded-[20px] ${canWrite ? 'bg-btn-bg' : 'bg-tertiary opacity-70'}`}
        >
          <Text className="text-btn-text text-[13px] font-semibold tracking-[0.5px]">
            글쓰기
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
