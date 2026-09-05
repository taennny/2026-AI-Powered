import {View, Text, TouchableOpacity} from 'react-native';
import {router} from 'expo-router';

import {type JournalData} from '@/services/blogApi';
import {useThemeColors} from '@/hooks/useThemeColors';
import {formatDateStr, formatDateFromISO} from '@/utils/formatDate';

type Props = {
  data: JournalData;
  query?: string;
};

/**
 * 카드 미리보기는 한 덩어리로 흘려 쓴다 — 본문의 줄바꿈을 그대로 두면
 * 3번째 줄이 하드 개행으로 끝나서 RN이 "잘린 게 아니라 줄이 끝났다"고 보고
 * 말줄임(…)을 붙이지 않는다. 글이 문단으로 나뉘어 있으면 늘 이렇게 된다.
 */
const collapseLines = (text: string) => text.replace(/\s+/g, ' ').trim();

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
      <Text
        className={className}
        numberOfLines={numberOfLines}
        ellipsizeMode="tail"
      >
        {text}
      </Text>
    );
  }
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <Text
      className={className}
      numberOfLines={numberOfLines}
      ellipsizeMode="tail"
    >
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <Text key={i} style={{color: highlightColor}}>
            {part}
          </Text>
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
          text={collapseLines(data.summary)}
          query={query}
          className="text-[13px] text-secondary"
          highlightColor={tc.tealAccent}
          numberOfLines={3}
        />
      )}
    </TouchableOpacity>
  );
}
