/**
 * @file components/bottomsheet/PostCard.tsx
 * @description 바텀시트 타임라인 내 장소 카드 컴포넌트
 *
 * ## 다음 연결 작업
 * - [ ] 카드 탭 시 journal-detail 화면으로 이동
 */

import {Text, TouchableOpacity} from 'react-native';

import {type TimelinePlace} from '@/services/calendarApi';
import {Colors} from '@/constants/Colors';
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
      style={{
        backgroundColor: Colors.white,
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginBottom: 10,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      <Text style={{fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 4}}>
        {timeLabel}
      </Text>

      <Text style={{fontSize: 13, color: Colors.textMedium, marginBottom: 2}}>
        {name}
      </Text>

      <Text style={{fontSize: 12, color: Colors.textTertiary}}>
        {category}
      </Text>
    </TouchableOpacity>
  );
}
