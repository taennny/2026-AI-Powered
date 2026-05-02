/**
 * @file app/(main)/write-preview/index.tsx
 * @description 글쓰기 미리보기/저장 화면
 * - write 화면에서 생성된 title, content, photoUrl을 파라미터로 수신
 * - 제목/내용 수정 후 saveJournal() 호출
 * - 이미지 교체 시 로컬 URI를 uploadPhoto()로 재업로드 후 저장
 */

import React, {useState} from 'react';
import {
  Alert,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {saveJournal, uploadPhoto} from '@/services/journalApi';
import {Colors} from '@/constants/Colors';

export default function WritePreviewScreen() {
  const router = useRouter();

  const {title, content, photoUrl} = useLocalSearchParams<{
    title?: string;
    content?: string;
    photoUrl?: string;
  }>();

  const [journalTitle, setJournalTitle] = useState(title || '');
  const [journalContent, setJournalContent] = useState(content || '');
  const [selectedImageUri, setSelectedImageUri] = useState(photoUrl || '');
  const [isSaving, setIsSaving] = useState(false);

  const canSave = journalTitle.trim().length > 0 && journalContent.trim().length > 0;

  const handleCancelPress = () => {
    Alert.alert('작성 취소', '수정 중인 글을 취소할까요?', [
      {text: '계속 수정', style: 'cancel'},
      {text: '취소', style: 'destructive', onPress: () => router.replace('/(main)/(tabs)/home')},
    ]);
  };

  const handleImageChangePress = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({mediaTypes: ['images'], quality: 0.8});
    if (!result.canceled) {
      setSelectedImageUri(result.assets[0].uri);
    }
  };

  const handleImageDeletePress = () => {
    setSelectedImageUri('');
  };

  const handleSavePress = async () => {
    if (!canSave) {
      Alert.alert('알림', '제목과 내용을 입력해주세요.');
      return;
    }
    try {
      setIsSaving(true);

      let finalPhotoUrl: string | undefined;
      if (selectedImageUri) {
        if (selectedImageUri.startsWith('http')) {
          finalPhotoUrl = selectedImageUri;
        } else {
          const uploaded = await uploadPhoto(selectedImageUri);
          finalPhotoUrl = uploaded.photo_url;
        }
      }

      await saveJournal({
        title: journalTitle,
        content: journalContent,
        photoUrl: finalPhotoUrl,
      });

      Alert.alert('완료', '글이 저장되었습니다.', [
        {text: '확인', onPress: () => router.replace('/(main)/(tabs)/home')},
      ]);
    } catch {
      Alert.alert('오류', '저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">

      {/* 헤더 */}
      <View className="px-[18px] pt-[14px] pb-3 flex-row justify-between">
        <TouchableOpacity onPress={handleCancelPress}>
          <Text className="text-xs text-muted">Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSavePress} disabled={!canSave || isSaving}>
          <Text className={`text-xs font-bold${!canSave || isSaving ? ' text-muted' : ' text-primary'}`}>
            {isSaving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{paddingHorizontal: 20, paddingBottom: 40, alignItems: 'center'}}>
        <TextInput
          className="text-base font-bold text-primary mb-4"
          style={{width: '90%', padding: 0, textAlign: 'center'}}
          value={journalTitle}
          onChangeText={setJournalTitle}
          placeholder="제목"
          placeholderTextColor={Colors.textTertiary}
          textAlign="center"
        />

        {selectedImageUri ? (
          <View className="w-full mb-5">
            <TouchableOpacity onPress={handleImageChangePress}>
              <Image source={{uri: selectedImageUri}} className="w-full h-[250px]" />
            </TouchableOpacity>
            <TouchableOpacity className="mt-2 self-center" onPress={handleImageDeletePress}>
              <Text className="text-xs text-tertiary">사진 삭제</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            className="w-full h-[210px] bg-[#F2F2F2] justify-center items-center mb-5"
            onPress={handleImageChangePress}
          >
            <Text className="text-sm text-tertiary">사진 추가</Text>
          </TouchableOpacity>
        )}

        <TextInput
          className="text-sm text-primary leading-[22px]"
          style={{width: '90%', minHeight: 160, textAlign: 'center'}}
          value={journalContent}
          onChangeText={setJournalContent}
          multiline
          placeholder="내용"
          placeholderTextColor={Colors.textTertiary}
          textAlign="center"
        />
      </ScrollView>

    </SafeAreaView>
  );
}
