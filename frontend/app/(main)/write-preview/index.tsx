/**
 * @file app/(main)/write-preview/index.tsx
 * @description 글쓰기 미리보기/저장 화면
 */

import React, {useState} from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useLocalSearchParams, useRouter} from 'expo-router';

import {updateBlog} from '@/services/blogApi';
import {useThemeColors} from '@/hooks/useThemeColors';

export default function WritePreviewScreen() {
  const router = useRouter();
  const tc = useThemeColors();

  const {blogId, title, content} = useLocalSearchParams<{
    blogId?: string;
    title?: string;
    content?: string;
  }>();

  const [journalTitle, setJournalTitle] = useState(title || '');
  const [journalContent, setJournalContent] = useState(content || '');
  const [isSaving, setIsSaving] = useState(false);

  const canSave =
    journalTitle.trim().length > 0 && journalContent.trim().length > 0;

  const handleCancelPress = () => {
    Alert.alert('작성 취소', '수정 중인 글을 취소할까요?', [
      {text: '계속 수정', style: 'cancel'},
      {
        text: '취소',
        style: 'destructive',
        onPress: () => router.replace('/(main)/(tabs)/journal-list'),
      },
    ]);
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

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="px-[18px] pt-[14px] pb-3 flex-row justify-between">
        <TouchableOpacity onPress={handleCancelPress}>
          <Text className="text-xs text-muted">Cancel</Text>
        </TouchableOpacity>

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