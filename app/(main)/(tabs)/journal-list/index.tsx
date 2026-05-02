/**
 * @file app/(main)/(tabs)/journal-list/index.tsx — 저널 리스트 화면
 * - 검색 바: 아이콘 탭 → 확장 애니메이션, X 탭 → 축소
 * - 검색 대상: 제목, 본문 미리보기, 날짜
 */

import {useState, useRef, useEffect} from 'react';
import {
  View,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';

import {fetchBlogs, type JournalData} from '@/services/blogApi';
import {Colors} from '@/constants/Colors';
import JournalCard from '@/components/journal/JournalCard';
import {formatDateStr} from '@/utils/formatDate';

const SCREEN_WIDTH = Dimensions.get('window').width;
const BAR_COLLAPSED = 40;
const BAR_EXPANDED = SCREEN_WIDTH - 32;

export default function JournalListScreen() {
  const [journals, setJournals] = useState<JournalData[]>([]);
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const widthAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    fetchBlogs()
      .then(data => setJournals(data.blogs))
      .catch(() => setJournals([]));
  }, []);

  const expand = () => {
    setIsFocused(true);
    Animated.spring(widthAnim, {toValue: 1, useNativeDriver: false, tension: 80, friction: 10})
      .start(() => inputRef.current?.focus());
  };

  const collapse = () => {
    setQuery('');
    inputRef.current?.blur();
    Animated.spring(widthAnim, {toValue: 0, useNativeDriver: false, tension: 80, friction: 10})
      .start(() => setIsFocused(false));
  };

  const barWidth = widthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [BAR_COLLAPSED, BAR_EXPANDED],
  });

  const filtered = journals.filter(j => {
    const q = query.toLowerCase();
    return (
      j.title.toLowerCase().includes(q) ||
      (j.summary ?? '').toLowerCase().includes(q) ||
      formatDateStr(j.date).toLowerCase().includes(q)
    );
  });

  return (
    <View className="flex-1 bg-teal">

      {/* 검색 바 */}
      <View className="px-4 mt-3 mb-3 flex-row justify-end">
        <Animated.View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: Colors.white,
            borderRadius: 20,
            height: 40,
            width: barWidth,
            overflow: 'hidden',
          }}
        >
          <TouchableOpacity
            onPress={isFocused ? undefined : expand}
            style={{width: 40, height: 40, alignItems: 'center', justifyContent: 'center'}}
          >
            <Ionicons name="search" size={16} color={Colors.textTertiary} />
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor={Colors.textTertiary}
            style={{
              flex: 1,
              fontSize: 14,
              color: Colors.textPrimary,
              padding: 0,
              opacity: isFocused ? 1 : 0,
            }}
          />

          {isFocused && (
            <TouchableOpacity
              onPress={collapse}
              style={{paddingHorizontal: 12, height: 40, alignItems: 'center', justifyContent: 'center'}}
            >
              <Ionicons name="close" size={16} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingHorizontal: 16, paddingBottom: 32}}
      >
        {filtered.map(journal => (
          <JournalCard key={journal.id} data={journal} query={query} />
        ))}
      </ScrollView>

    </View>
  );
}
