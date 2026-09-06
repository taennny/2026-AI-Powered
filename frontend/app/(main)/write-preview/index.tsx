import React, {useEffect, useRef, useState} from 'react';
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
import {useLocalSearchParams, useNavigation, useRouter} from 'expo-router';

import {deleteBlog, fetchBlogDetail, updateBlog} from '@/services/blogApi';
import {useThemeColors} from '@/hooks/useThemeColors';
import {clearCalendarCache} from '@/hooks/useCalendar';
import {clearJournalCache} from '@/hooks/useJournalList';

/**
 * 글 목록이 달라졌으니 캐시를 버린다 — 삭제·저장 양쪽 다 필요하다.
 * 안 버리면 지운 글과 캘린더 동그라미가 잠깐 되살아나고,
 * 새로 쓴 글은 반대로 한 박자 늦게 나타난다.
 */
function invalidateCaches() {
  clearCalendarCache();
  clearJournalCache();
}

export default function WritePreviewScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const tc = useThemeColors();

  const {blogId, title, content, targetData, dates, createdAt} =
    useLocalSearchParams<{
      blogId?: string;
      title?: string;
      content?: string;
      targetData?: string;
      /** 모아쓰기에 포함된 날짜 — 'YYYY-MM-DD' 콤마 목록 */
      dates?: string;
      createdAt?: string;
    }>();

  const [journalTitle, setJournalTitle] = useState(title || '');
  const [journalContent, setJournalContent] = useState(content || '');
  const [journalTargetDate, setJournalTargetDate] = useState(targetData || '');
  const [journalDates, setJournalDates] = useState<string[]>(() =>
    dates ? dates.split(',').filter(Boolean) : [],
  );
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
        setJournalDates(detail.dates ?? []);
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

    const yy = String(parsedDate.getFullYear()).slice(2);
    const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(parsedDate.getDate()).padStart(2, '0');

    return `${yy}.${mm}.${dd}`;
  };

  /**
   * 모아쓰기는 첫 날만 적고 나머지는 개수로 줄인다 — 날짜를 다 나열하면
   * 31일까지 가능해서 한 줄을 넘긴다.
   * `target_date`가 첫 날이므로 나머지는 전체에서 하나 뺀 값이다.
   */
  const extraDayCount = Math.max(journalDates.length - 1, 0);

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
                invalidateCaches();
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
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        backActionRef.current();
        return true; // 기본 뒤로가기 차단 — 이동은 확인 후 handleCancelPress가 한다
      },
    );

    return () => subscription.remove();
  }, []);

  /**
   * iOS 스와이프 뒤로가기도 같은 취소 경로로 보낸다.
   *
   * `gestureEnabled: false`만 믿을 수 없었다 — New Architecture에서 그 옵션이
   * 무시돼 스와이프가 통하는 경우가 있었고, 그러면 생성한 글이 서버에 남은 채
   * 화면만 사라진다. 확인 후의 이동은 replace라 GO_BACK이 아니어서 다시 걸리지 않는다.
   */
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', event => {
      if (event.data.action.type !== 'GO_BACK') return;

      event.preventDefault();
      backActionRef.current();
    });

    return unsubscribe;
  }, [navigation]);

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
              invalidateCaches();
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

      invalidateCaches();

      Alert.alert('완료', '글이 저장되었습니다.', [
        {
          text: '확인',
          onPress: () => router.replace('/(main)/(tabs)/journal-list'),
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
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 80,
            alignItems: 'center',
          }}
        >
          <View className="w-[90%] mb-5">
            <Text className="text-sm font-semibold text-primary">
              위치 기록 날짜 {formatDate(journalTargetDate)}
              {extraDayCount > 0 ? ` 외 ${extraDayCount}일` : ''}
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

          <View className="w-[90%] mt-10 pt-4 border-t border-line">
            <Text className="text-[11px] text-muted text-center">
              이 글은 AI로 생성되었습니다.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
