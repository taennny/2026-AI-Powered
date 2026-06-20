/**
 * @file components/bottomsheet/PostCard.tsx — 바텀시트 타임라인 장소 카드
 *
 * ## 다음 연결 작업
 * - [ ] 카드 탭 시 journal-detail 화면으로 이동
 */

import {Text, TouchableOpacity} from 'react-native';

import {type TimelinePlace} from '@/services/calendarApi';
import {formatTimeFromISO} from '@/utils/formatDate';

type Props = {
  data: TimelinePlace;
};

export default function PostCard({data}: Props) {
  const {name, category, arrived_at, left_at} = data;
  const timeLabel = `${formatTimeFromISO(arrived_at)} ~ ${formatTimeFromISO(left_at)}`;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      className="bg-white rounded-[14px] px-4 py-[14px] mb-[10px]"
      style={{boxShadow: '0 1px 4px rgba(0,0,0,0.06)'}}
    >
      <Text className="text-sm font-semibold text-primary mb-1">{timeLabel}</Text>
      <Text className="text-[13px] text-medium mb-0.5">{name}</Text>
      <Text className="text-xs text-tertiary">{category}</Text>
    </TouchableOpacity>
  );
}
