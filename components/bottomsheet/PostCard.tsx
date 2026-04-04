/**
 * @file components/bottomsheet/PostCard.tsx
 * @description 바텀시트 타임라인 내 일정 카드 컴포넌트
 *
 * ## 다음 연결 작업
 * - [ ] 카드 탭 시 journal-detail 화면으로 이동
 * - [ ] PostCardData → 실제 API 타입으로 교체
 */

import {View, Text, TouchableOpacity} from 'react-native';

import {type PostCardData} from '@/constants/dummyData';
import {Colors} from '@/constants/Colors';

type Props = {
  data: PostCardData;
};

/** 'HH:MM' 24h → '12:00PM' 형식으로 변환 */
function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${String(m).padStart(2, '0')}${period}`;
}

export default function PostCard({data}: Props) {
  const {emoji, startTime, endTime, placeName, category} = data;
  const timeLabel = `${formatTime(startTime)} ~ ${formatTime(endTime)}`;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={{
        backgroundColor: Colors.white,
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      <Text style={{fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 4}}>
        {emoji} {timeLabel}
      </Text>

      <Text style={{fontSize: 13, color: Colors.textMedium, marginBottom: 2}}>
        {placeName}
      </Text>

      <Text style={{fontSize: 12, color: Colors.textTertiary}}>
        {category}
      </Text>
    </TouchableOpacity>
  );
}
