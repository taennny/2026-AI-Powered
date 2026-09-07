import {useState, useRef} from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';

import {useJournalList} from '@/hooks/useJournalList';
import {useThemeColors} from '@/hooks/useThemeColors';
import JournalCard from '@/components/journal/JournalCard';

const SCREEN_WIDTH = Dimensions.get('window').width;
const BAR_COLLAPSED = 40;
const BAR_EXPANDED = SCREEN_WIDTH - 32;

export default function JournalListScreen() {
  const {
    query,
    setQuery,
    appliedQuery,
    search,
    clearSearch,
    journals,
    isLoading,
    isLoadingMore,
    loadMore,
  } = useJournalList();
  const [isFocused, setIsFocused] = useState(false);
  const widthAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);
  const tc = useThemeColors();

  const expand = () => {
    setIsFocused(true);
    Animated.spring(widthAnim, {
      toValue: 1,
      useNativeDriver: false,
      tension: 80,
      friction: 10,
    }).start(() => inputRef.current?.focus());
  };

  const collapse = () => {
    clearSearch();
    inputRef.current?.blur();
    Animated.spring(widthAnim, {
      toValue: 0,
      useNativeDriver: false,
      tension: 80,
      friction: 10,
    }).start(() => setIsFocused(false));
  };

  const barWidth = widthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [BAR_COLLAPSED, BAR_EXPANDED],
  });

  return (
    <View className="flex-1 bg-teal">
      <View className="px-4 mt-3 mb-3 flex-row justify-end">
        <Animated.View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: tc.card,
            borderRadius: 20,
            height: 40,
            width: barWidth,
            overflow: 'hidden',
          }}
        >
          <TouchableOpacity
            onPress={isFocused ? search : expand}
            style={{
              width: 40,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="search" size={16} color={tc.tertiary} />
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor={tc.tertiary}
            returnKeyType="search"
            onSubmitEditing={search}
            style={{
              flex: 1,
              fontSize: 14,
              color: tc.primary,
              padding: 0,
              opacity: isFocused ? 1 : 0,
            }}
          />

          {isFocused && (
            <TouchableOpacity
              onPress={collapse}
              style={{
                paddingHorizontal: 12,
                height: 40,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="close" size={16} color={tc.tertiary} />
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" />
        </View>
      ) : (
        <FlatList
          data={journals}
          keyExtractor={journal => journal.id}
          renderItem={({item}) => (
            // 입력 중인 query가 아니라 이 목록을 만들어낸 검색어로 칠한다
            <JournalCard data={item} query={appliedQuery} />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{paddingHorizontal: 16, paddingBottom: 32}}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text className="text-center text-sm text-secondary mt-10">
              {appliedQuery
                ? '검색 결과가 없어요.'
                : '아직 작성한 글이 없어요.'}
            </Text>
          }
          ListFooterComponent={
            isLoadingMore ? (
              <ActivityIndicator size="small" className="my-4" />
            ) : null
          }
        />
      )}
    </View>
  );
}
