/**
 * @file components/journal/JournalCard.tsx
 * @description 저널 리스트 화면 카드 컴포넌트
 *
 * ## 다음 연결 작업
 * - [ ] 카드 탭 시 journal-detail 화면으로 이동
 * - [ ] JournalData → 실제 API 타입으로 교체
 */

import {View, Text, TouchableOpacity} from 'react-native';

import {type JournalData} from '@/services/blogApi';
import {Colors} from '@/constants/Colors';
import {formatDateStr, formatTimeAgo} from '@/utils/formatDate';

type Props = {
  data: JournalData;
  /** 검색어 — 일치하는 텍스트 하이라이트 */
  query?: string;
};

/**
 * 검색어와 일치하는 부분을 tealAccent 색상으로 강조 렌더링
 * query가 없으면 일반 Text로 렌더링
 */
function HighlightText({
  text,
  query,
  style,
}: {
  text: string;
  query: string;
  style?: object;
}) {
  if (!query.trim()) {
    return <Text style={style}>{text}</Text>;
  }

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));

  return (
    <Text style={style}>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <Text key={i} style={{color: Colors.tealAccent}}>
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
      <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4}}>
        <Text style={{fontSize: 13, fontWeight: '600', color: Colors.textPrimary}}>
          {formatDateStr(data.date)}
        </Text>
        <Text style={{fontSize: 12, color: Colors.textTertiary}}>
          {formatTimeAgo(data.created_at)}
        </Text>
      </View>

      <HighlightText
        text={data.title}
        query={query}
        style={{fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 3}}
      />

      {data.summary !== null && (
        <HighlightText
          text={data.summary}
          query={query}
          style={{fontSize: 13, color: Colors.textSecondary}}
        />
      )}
    </TouchableOpacity>
  );
}
