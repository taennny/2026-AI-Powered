import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {
  Stack,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from 'expo-router';

import {
  buildDateTarget,
  generateBlog,
  waitForBlogGeneration,
  WritingStyle,
} from '@/services/blogApi';
import {useThemeColors} from '@/hooks/useThemeColors';
import {formatShortDate} from '@/utils/formatDate';
import RotatingMessage from '@/components/write/RotatingMessage';
import {
  CLOSING_MESSAGE,
  PROGRESS_MESSAGES,
  TIP_MESSAGES,
} from '@/constants/loadingMessages';
import {buildLoadingSequence} from '@/utils/loadingSequence';
import {describeBlogGenerationError} from '@/utils/blogGenerationError';
import {useDateSelectionStore} from '@/store/dateSelectionStore';

export default function WriteScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const tc = useThemeColors();

  const {dailyRecordId, dates} = useLocalSearchParams<{
    dailyRecordId?: string;
    /** 모아쓰기 — 'YYYY-MM-DD' 오름차순 콤마 목록 */
    dates?: string;
  }>();

  const dateKeys = useMemo(
    () => (dates ? dates.split(',').filter(Boolean) : []),
    [dates],
  );
  const isMultiDay = dateKeys.length > 0;
  const clearSelection = useDateSelectionStore(s => s.clear);

  const [writingStyle, setWritingStyle] = useState<WritingStyle>('info');
  const [place, setPlace] = useState('');
  const [companion, setCompanion] = useState('');
  const [feeling, setFeeling] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 생성을 누를 때마다 다시 섞는다 — 실패 후 또 눌러도 같은 순서가 반복되지 않고,
  // 금방 끝나는 사람도 매번 다른 팁을 본다
  const [loadingMessages, setLoadingMessages] = useState<string[]>([]);

  useEffect(() => {
    if (!isLoading) return;

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => true,
    );

    return () => subscription.remove();
  }, [isLoading]);

  /**
   * 화면을 벗어나려는 시도를 여기서 가로챈다 — 스와이프든 뒤로가기든 전부 지난다.
   *
   * `gestureEnabled: false`만으로는 부족했다. New Architecture에서 그 옵션이
   * 무시돼 생성 중에도 스와이프로 빠져나가지는 경우가 있었다.
   * 'Home' 버튼은 replace라 GO_BACK이 아니고, 미리보기로 넘어가는 것은 push라
   * 이 화면이 스택에서 빠지지 않으므로 둘 다 여기 걸리지 않는다.
   */
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', event => {
      if (event.data.action.type !== 'GO_BACK') return;

      event.preventDefault();

      // 생성 중에는 물어볼 것도 없다 — 나가면 만들던 글이 서버에 남는다
      if (isLoading) return;

      Alert.alert('작성 취소', '글쓰기를 취소하고 나갈까요?', [
        {text: '계속 작성', style: 'cancel'},
        {
          text: '나가기',
          style: 'destructive',
          onPress: () => navigation.dispatch(event.data.action),
        },
      ]);
    });

    return unsubscribe;
  }, [navigation, isLoading]);
  // 입력은 전부 선택이다 — 아무것도 안 적으면 타임라인만으로 생성한다
  const canSubmit = isMultiDay || !!dailyRecordId;

  // 작성일(오늘)이다. 표시용이라 4시 경계를 적용하지 않는다 —
  // 새벽 2시에 쓴 글의 작성일은 실제로 오늘이다
  const dateStr = useMemo(() => formatShortDate(new Date()), []);

  const handleHomePress = () => {
    Alert.alert('작성 취소', '글쓰기를 취소하고 홈으로 이동할까요?', [
      {text: '계속 작성', style: 'cancel'},
      {
        text: '이동',
        style: 'destructive',
        onPress: () => router.replace('/(main)/(tabs)/home'),
      },
    ]);
  };

  const handleWritePress = async () => {
    if (!isMultiDay && !dailyRecordId) {
      Alert.alert('오류', '날짜 기록 정보가 없습니다.');
      return;
    }

    try {
      setLoadingMessages(
        buildLoadingSequence(PROGRESS_MESSAGES, TIP_MESSAGES, CLOSING_MESSAGE),
      );
      setIsLoading(true);
      // 빈 항목은 빼고 보낸다 — `오늘 간 장소: `처럼 레이블만 가면 AI가 그걸 내용으로 읽는다
      const userNote =
        [
          place.trim() && `오늘 간 장소: ${place.trim()}`,
          companion.trim() && `함께한 사람: ${companion.trim()}`,
          feeling.trim() && `오늘의 감정: ${feeling.trim()}`,
          prompt.trim() && `추가 요청: ${prompt.trim()}`,
        ]
          .filter(Boolean)
          .join('\n') || undefined;

      const generateResult = await generateBlog({
        ...(isMultiDay
          ? buildDateTarget(dateKeys)
          : {daily_record_id: dailyRecordId}),
        user_note: userNote,
        writing_style: writingStyle,
      });

      const blog = await waitForBlogGeneration(generateResult.blog_id);

      // 글이 나왔으면 선택은 끝났다 — 안 비우면 홈에 돌아가도 선택 모드가 남는다
      if (isMultiDay) clearSelection();

      router.push({
        pathname: '/(main)/write-preview',
        params: {
          blogId: String(blog.blog_id),
          title: blog.title,
          content: blog.content,
          targetData: blog.target_date,
          // 고를 때의 dateKeys가 아니라 서버가 준 목록을 넘긴다 —
          // 기록이 없는 날은 서버가 빼므로 개수가 다를 수 있다
          dates: (blog.dates ?? []).join(','),
          createdAt: blog.created_at,
        },
      });
    } catch (error) {
      const {title, message, showSubscription} =
        describeBlogGenerationError(error);

      Alert.alert(
        title,
        message,
        showSubscription
          ? [
              {text: '닫기', style: 'cancel'},
              {
                text: '구독 보기',
                onPress: () => router.push('/(main)/settings/subscription'),
              },
            ]
          : undefined,
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            gestureEnabled: false,
            headerBackVisible: false,
          }}
        />

        <SafeAreaView className="flex-1 bg-surface justify-center items-center">
          <ActivityIndicator size="large" />

          <View className="mt-[14px]">
            <RotatingMessage messages={loadingMessages} />
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="px-[22px] pt-4 pb-[10px] flex-row justify-between">
          <View className="flex-row items-baseline gap-x-2">
            <Text className="text-xl font-bold text-primary">{dateStr}</Text>

            {/* 하루만 고른 경우는 모아쓰기라고 하지 않는다 */}
            {dateKeys.length > 1 && (
              <Text className="text-xs text-tertiary">
                {dateKeys.length}일 모아쓰는 중
              </Text>
            )}
          </View>

          <TouchableOpacity onPress={handleHomePress}>
            <Text className="text-xs text-muted mt-[6px]">Home</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row mx-[22px] h-[34px] bg-teal-bg rounded-[7px] p-0.5">
          <TouchableOpacity
            className={`flex-1 rounded-md justify-center items-center${
              writingStyle === 'info' ? ' bg-surface' : ''
            }`}
            onPress={() => setWritingStyle('info')}
          >
            <Text className="text-xs font-semibold text-primary">
              정보 위주
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-1 rounded-md justify-center items-center${
              writingStyle === 'emotion' ? ' bg-surface' : ''
            }`}
            onPress={() => setWritingStyle('emotion')}
          >
            <Text className="text-xs font-semibold text-primary">감성적</Text>
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-[22px] pt-[18px]">
          <Text className="mb-2 text-sm font-semibold text-primary">
            오늘 간 장소는 어디인가요?
          </Text>

          <TextInput
            className="mb-5 rounded-md border border-line px-4 py-3 text-sm text-primary"
            value={place}
            onChangeText={setPlace}
            placeholder="예) 서울숲, 성수동, 부산 해운대"
            placeholderTextColor={tc.tertiary}
          />

          <Text className="mb-2 text-sm font-semibold text-primary">
            누구와 함께하셨나요?
          </Text>

          <TextInput
            className="mb-5 rounded-md border border-line px-4 py-3 text-sm text-primary"
            value={companion}
            onChangeText={setCompanion}
            placeholder="예) 친구, 가족, 연인, 혼자"
            placeholderTextColor={tc.tertiary}
          />

          <Text className="mb-2 text-sm font-semibold text-primary">
            오늘의 감정은 어떠셨나요?
          </Text>

          <TextInput
            className="mb-5 rounded-md border border-line px-4 py-3 text-sm text-primary"
            style={{minHeight: 90, textAlignVertical: 'top'}}
            value={feeling}
            onChangeText={setFeeling}
            multiline
            placeholder="오늘의 기분이나 인상 깊었던 감정을 적어주세요."
            placeholderTextColor={tc.tertiary}
          />
          <Text className="mb-2 text-sm font-semibold text-primary">
            추가로 남기고 싶은 내용이 있나요?
          </Text>
          <TextInput
            className="mb-6 rounded-md border border-line px-4 py-3 text-sm text-primary"
            style={{minHeight: 120, textAlignVertical: 'top'}}
            value={prompt}
            onChangeText={setPrompt}
            multiline
            placeholder="AI가 글을 작성할 때 참고할 내용을 자유롭게 적어주세요. (선택)"
            placeholderTextColor={tc.tertiary}
          />
        </ScrollView>

        <View className="h-[72px] border-t border-line bg-surface px-[22px] items-end justify-center">
          <TouchableOpacity
            className={`bg-teal px-[22px] py-[10px] rounded-md${
              !canSubmit ? ' opacity-50' : ''
            }`}
            onPress={handleWritePress}
            disabled={!canSubmit}
          >
            <Text className="text-xs font-bold text-primary">글쓰기</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
