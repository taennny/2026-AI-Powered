import {View, Text, TouchableOpacity} from 'react-native';
import {router} from 'expo-router';

import {type JournalData} from '@/services/blogApi';
import {useThemeColors} from '@/hooks/useThemeColors';
import {formatDateStr, formatDateFromISO} from '@/utils/formatDate';

type Props = {
  data: JournalData;
  query?: string;
};

function HighlightText({
  text,
  query,
  className,
  highlightColor,
  numberOfLines,
}: {
  text: string;
  query: string;
  className?: string;
  highlightColor: string;
  numberOfLines?: number;
}) {
  if (!query.trim()) {
    return (
      <Text className={className} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <Text className={className} numberOfLines={numberOfLines}>
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
<View className="mb-2">
  <HighlightText
    text={`위치 기록일 ${formatDateStr(data.date)}`}
    query={query}
    className="text-[13px] font-semibold text-primary"
    highlightColor={tc.tealAccent}
  />

  <HighlightText
    text={`작성일 ${formatDateFromISO(data.created_at)}`}
    query={query}
    className="text-[11px] text-tertiary mt-1"
    highlightColor={tc.tealAccent}
  />
</View>
      <HighlightText
        text={data.title}
        query={query}
        className="text-sm font-semibold text-primary mb-[3px]"
        highlightColor={tc.tealAccent}
        numberOfLines={1}
      />
      {data.summary !== null && (
        <HighlightText
          text={data.summary}
          query={query}
          className="text-[13px] text-secondary"
          highlightColor={tc.tealAccent}
          numberOfLines={3}
        />
      )}
    </TouchableOpacity>
  );
}
