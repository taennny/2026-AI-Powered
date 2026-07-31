/**
 * 바텀시트 타임라인 장소 카드
 *
 * TODO: 탭 동작 미정. 현재 TouchableOpacity에 onPress가 없어 눌리는 반응만 나고
 * 아무 일도 일어나지 않는다. TimelinePlace에는 blogId가 없으므로 저널 화면으로
 * 보낼 수는 없다 — 사진 뷰어 / 장소 상세 / 장소명 수정 중 기획 결정 필요.
 */

import {View, Text, Image, TouchableOpacity} from 'react-native';

import {type TimelinePlace} from '@/services/calendarApi';
import {formatTimeFromISO} from '@/utils/formatDate';

type Props = {
  data: TimelinePlace;
};

export default function PostCard({data}: Props) {
  const {name, category, arrived_at, left_at, photos} = data;
  const timeLabel = `${formatTimeFromISO(arrived_at)} ~ ${formatTimeFromISO(left_at)}`;
  const firstPhoto = photos?.[0];

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      className="bg-card rounded-[14px] px-4 py-[14px] mb-[10px] flex-row justify-between items-center"
      style={{boxShadow: '0 1px 4px rgba(0,0,0,0.06)'}}
    >
      <View className="flex-1">
        <Text className="text-sm font-semibold text-primary mb-1">{timeLabel}</Text>
        <Text className="text-[13px] text-medium mb-0.5">{name}</Text>
        <Text className="text-xs text-tertiary">{category}</Text>
      </View>
      {firstPhoto && (
        <Image
          source={{uri: firstPhoto}}
          className="w-[60px] h-[60px] rounded-[10px] ml-3"
        />
      )}
    </TouchableOpacity>
  );
}
