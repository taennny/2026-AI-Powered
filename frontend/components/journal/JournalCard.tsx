/**
 * @file components/journal/JournalCard.tsx — 저널 리스트 카드
 * - 카드 탭 → write-preview(미리보기·저장 화면)로 이동, blogId만 넘기면
 *   해당 화면이 상세를 조회해 채운다.
 */

import {View, Text, TouchableOpacity} from 'react-native';
import {router} from 'expo-router';

import {type JournalData} from '@/services/blogApi';
import {useThemeColors} from '@/hooks/useThemeColors';
import {formatDateStr, formatTimeAgo} from '@/utils/formatDate';

type Props = {
  data: JournalData;
  query?: string;
};

function HighlightText({text, query, className, highlightColor}: {text: string; query: string; className?: string; highlightColor: string}) {
  if (!query.trim()) {
    return <Text className={className}>{text}</Text>;
  }
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <Text className={className}>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <Text key={i} style={{color: highlightColor}}>{part}</Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

export default function JournalCard({data, query = ''}: Props) {
  const tc = useThemeColors();
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() =>
        router.push({
          pathname: '/(main)/write-preview',
          params: {blogId: data.id},
        })
      }
      className="bg-surface rounded-[14px] px-4 py-[14px] mb-[10px]"
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
        highlightColor={tc.tealAccent}
      />
      {data.summary !== null && (
        <HighlightText
          text={data.summary}
          query={query}
          className="text-[13px] text-secondary"
          highlightColor={tc.tealAccent}
        />
      )}
    </TouchableOpacity>
  );
}
