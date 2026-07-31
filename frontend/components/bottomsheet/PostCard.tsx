/** 탭 동작 미정 — 눌리는 반응만 나고 아무 일도 안 일어나지 않도록 View로 둔다 */

import {View, Text, Image} from 'react-native';

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
    <View
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
    </View>
  );
}
