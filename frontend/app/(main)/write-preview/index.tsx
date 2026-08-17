import React, {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useLocalSearchParams, useRouter} from 'expo-router';

import {deleteBlog, fetchBlogDetail, updateBlog} from '@/services/blogApi';
import {useThemeColors} from '@/hooks/useThemeColors';


export default function WritePreviewScreen() {
  const router = useRouter();
  const tc = useThemeColors();

  const {blogId, title, content, targetData, createdAt} =
  useLocalSearchParams<{
    blogId?: string;
    title?: string;
    content?: string;
    targetData?: string;
    createdAt?: string;
  }>();

  const [journalTitle, setJournalTitle] = useState(title || '');
  const [journalContent, setJournalContent] = useState(content || '');
  const [journalTargetDate, setJournalTargetDate] = useState(targetData || '');
  const [journalCreatedAt, setJournalCreatedAt] = useState(createdAt || '');

  const [isSaving, setIsSaving] = useState(false);

  const needsFetch = !!blogId && !title;
  const isNewBlog = !!title;
  const [isLoading, setIsLoading] = useState(needsFetch);

  useEffect(() => {
    if (!needsFetch || !blogId) return;

    let isActive = true;

    fetchBlogDetail(blogId)
      .then(detail => {
        if (!isActive) return;
        setJournalTitle(detail.title);
        setJournalContent(detail.content);
        setJournalTargetDate(detail.target_date);
        setJournalCreatedAt(detail.created_at);
      })
      .catch(() => {
        if (!isActive) return;
        Alert.alert('오류', '글을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [blogId, needsFetch]);

  const canSave =
    journalTitle.trim().length > 0 && journalContent.trim().length > 0;
  const formatDate = (date?: string) => {
  if (!date) return '-';

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return date;
  }

  return parsedDate.toLocaleDateString('ko-KR');
};

 const handleCancelPress = () => {
  Alert.alert(
    isNewBlog ? '작성 취소' : '수정 취소',
    isNewBlog
      ? '생성한 글을 삭제하고 작성을 취소할까요?'
      : '수정한 내용을 저장하지 않고 나갈까요?',
    [
      {text: '계속 작성', style: 'cancel'},
      {
        text: '취소',
        style: 'destructive',
        onPress: async () => {
          if (isNewBlog && blogId) {
            try {
              await deleteBlog(blogId);
            } catch {
              Alert.alert(
                '오류',
                '글을 삭제하지 못했습니다. 다시 시도해주세요.',
              );
              return;
            }
          }

          router.replace('/(main)/(tabs)/journal-list');
        },
      },
    ],
  );
};

/**
 * 안드로이드 뒤로가기를 Cancel과 같은 경로로 — 그냥 두면 생성한 글이
 * 서버에 남은 채 화면만 사라진다. iOS는 제스처를 꺼서 막았다.
 */
const backActionRef = useRef<() => void>(() => {});
backActionRef.current = () => {
  if (isSaving) return;
  handleCancelPress();
};

useEffect(() => {
  const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
    backActionRef.current();
    return true; // 기본 뒤로가기 차단 — 이동은 확인 후 handleCancelPress가 한다
  });

  return () => subscription.remove();
}, []);

const handleDeletePress = () => {
  if (!blogId) return;

  Alert.alert(
    '글 삭제',
    '정말 이 글을 삭제하시겠습니까?\n삭제해도 생성 횟수는 돌아오지 않습니다.',
    [
      {text: '취소', style: 'cancel'},
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBlog(blogId);
            router.replace('/(main)/(tabs)/journal-list');
          } catch {
            Alert.alert('오류', '글을 삭제하지 못했습니다.');
          }
        },
      },
    ],
  );
};
  const handleSavePress = async () => {
    if (!canSave) {
      Alert.alert('알림', '제목과 내용을 입력해주세요.');
      return;
    }

    if (!blogId) {
      Alert.alert('오류', '저장할 글 정보가 없습니다.');
      return;
    }

    try {
      setIsSaving(true);

      await updateBlog(blogId, {
        title: journalTitle.trim(),
        content: journalContent.trim(),
      });

      Alert.alert('완료', '글이 저장되었습니다.', [
        {
          text: '확인',
          onPress: () =>
            router.replace('/(main)/(tabs)/journal-list'),
        },
      ]);
    } catch {
      Alert.alert('오류', '저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface justify-center items-center">
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="px-[18px] pt-[14px] pb-3 flex-row justify-between">
        <TouchableOpacity onPress={handleCancelPress}>
          <Text className="text-xs text-muted">Cancel</Text>
        </TouchableOpacity>

        {!isNewBlog && (
    <TouchableOpacity onPress={handleDeletePress}>
      <Text className="text-xs text-red-500">Delete</Text>
    </TouchableOpacity>
  )}


        <TouchableOpacity
          onPress={handleSavePress}
          disabled={!canSave || isSaving}
        >
          <Text
            className={`text-xs font-bold${
              !canSave || isSaving ? ' text-muted' : ' text-primary'
            }`}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 40,
          alignItems: 'center',
        }}
      >
        <View className="w-[90%] mb-5">
  <Text className="text-sm font-semibold text-primary">
  위치 기록 날짜 {formatDate(journalTargetDate)}
</Text>

<Text className="mt-1 text-xs text-muted">
  작성일 {formatDate(journalCreatedAt)}
</Text>
</View>
        <TextInput
          className="text-base font-bold text-primary mb-4"
          style={{width: '90%', padding: 0, textAlign: 'center'}}
          value={journalTitle}
          onChangeText={setJournalTitle}
          placeholder="제목"
          placeholderTextColor={tc.tertiary}
          textAlign="center"
        />

        <TextInput
          className="text-sm text-primary leading-[22px]"
          style={{width: '90%', minHeight: 160, textAlign: 'center'}}
          value={journalContent}
          onChangeText={setJournalContent}
          multiline
          placeholder="내용"
          placeholderTextColor={tc.tertiary}
          textAlign="center"
        />
      </ScrollView>
    </SafeAreaView>
  );
}