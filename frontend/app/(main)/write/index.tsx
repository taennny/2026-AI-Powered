import React, {useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useLocalSearchParams, useRouter} from 'expo-router';

import {
  generateBlog,
  waitForBlogGeneration,
  WritingStyle,
} from '@/services/blogApi';
import {useThemeColors} from '@/hooks/useThemeColors';
import {describeBlogGenerationError} from '@/utils/blogGenerationError';

export default function WriteScreen() {
  const router = useRouter();
  const tc = useThemeColors();

  const {dailyRecordId} = useLocalSearchParams<{
    dailyRecordId?: string;
  }>();

  const [writingStyle, setWritingStyle] = useState<WritingStyle>('info');
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const canSubmit = prompt.trim().length > 0 && !!dailyRecordId;

  const dateStr = useMemo(() => {
    const today = new Date();
    const yy = String(today.getFullYear()).slice(2);
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');

    return `${yy}.${mm}.${dd}`;
  }, []);

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
    if (!dailyRecordId) {
      Alert.alert('오류', '날짜 기록 정보가 없습니다.');
      return;
    }

    if (!canSubmit) {
      Alert.alert('알림', '내용을 입력해야 글을 생성할 수 있습니다.');
      return;
    }

    try {
      setIsLoading(true);

      const generateResult = await generateBlog({
        daily_record_id: dailyRecordId,
        user_note: prompt.trim(),
        writing_style: writingStyle,
      });

      const blog = await waitForBlogGeneration(generateResult.blog_id);

      router.push({
        pathname: '/(main)/write-preview',
        params: {
          blogId: String(blog.blog_id),
          title: blog.title,
          content: blog.content,
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
      <SafeAreaView className="flex-1 bg-surface justify-center items-center">
        <ActivityIndicator size="large" />

        <Text className="mt-[14px] text-sm text-tertiary">
          로미가 열심히 적고 있어요.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="px-[22px] pt-4 pb-[10px] flex-row justify-between">
          <Text className="text-xl font-bold text-primary">{dateStr}</Text>

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
          <TextInput
            className="text-sm text-primary leading-[22px]"
            style={{minHeight: 260, textAlignVertical: 'top'}}
            value={prompt}
            onChangeText={setPrompt}
            multiline
            placeholder="내용을 입력하세요"
            placeholderTextColor={tc.tertiary}
            textAlignVertical="top"
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
