/**
 * @file components/journal/JournalCard.tsx — 저널 리스트 카드
 *
 * ## 다음 연결 작업
 * - [ ] 카드 탭 시 journal-detail 화면으로 이동
 */

import {View, Text, TouchableOpacity} from 'react-native';

import {type JournalData} from '@/services/blogApi';
import {Colors} from '@/constants/Colors';
import {formatDateStr, formatTimeAgo} from '@/utils/formatDate';

type Props = {
  data: JournalData;
  query?: string;
};

function HighlightText({text, query, className}: {text: string; query: string; className?: string}) {
  if (!query.trim()) {
    return <Text className={className}>{text}</Text>;
  }
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <Text className={className}>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <Text key={i} style={{color: Colors.tealAccent}}>{part}</Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

export default function JournalCard({data, query = ''}: Props) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      className="bg-white rounded-[14px] px-4 py-[14px] mb-[10px]"
      style={{boxShadow: '0 1px 4px rgba(0,0,0,0.06)'}}
    >
      <View className="flex-row justify-between mb-1">
        <Text className="text-[13px] font-semibold text-primary">{formatDateStr(data.date)}</Text>
        <Text className="text-xs text-tertiary">{formatTimeAgo(data.created_at)}</Text>
      </View>
      <HighlightText
        text={data.title}
        query={query}
        className="text-sm font-semibold text-primary mb-[3px]"
      />
      {data.summary !== null && (
        <HighlightText
          text={data.summary}
          query={query}
          className="text-[13px] text-secondary"
        />
      )}
    </TouchableOpacity>
  );
}
