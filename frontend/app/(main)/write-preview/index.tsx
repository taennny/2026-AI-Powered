/**
 * @file app/(main)/write-preview/index.tsx
 * @description 글쓰기 미리보기/저장 화면
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
import {Colors} from '@/constants/Colors';
import {updateBlog} from '@/services/blogApi';
import {uploadPhoto} from '@/services/journalApi';

export default function WritePreviewScreen() {
  const router = useRouter();

  const {blogId, title, content, imageUris} = useLocalSearchParams<{
  blogId?: string;
  title?: string;
  content?: string;
  imageUris?: string;
}>();

  const parsedImageUris = imageUris ? JSON.parse(imageUris) : [];

  const [journalTitle, setJournalTitle] = useState(title || '');
  const [journalContent, setJournalContent] = useState(content || '');
  const [selectedImageUris, setSelectedImageUris] =
    useState<string[]>(parsedImageUris);
  const [isSaving, setIsSaving] = useState(false);

  const canSave =
    journalTitle.trim().length > 0 && journalContent.trim().length > 0;

  const handleCancelPress = () => {
    Alert.alert('작성 취소', '수정 중인 글을 취소할까요?', [
      {text: '계속 수정', style: 'cancel'},
      {
        text: '취소',
        style: 'destructive',
        onPress: () => router.replace('/(main)/(tabs)/home'),
      },
    ]);
  };

  const handleImageAddPress = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
    });

    if (!result.canceled) {
      const newImageUris = result.assets.map((asset) => asset.uri);

      setSelectedImageUris((prevImageUris) => [
        ...prevImageUris,
        ...newImageUris,
      ]);
    }
  };

  const handleImageDeletePress = (targetImageUri: string) => {
    setSelectedImageUris((prevImageUris) =>
      prevImageUris.filter((imageUri) => imageUri !== targetImageUri),
    );
  };

  const handleSavePress = async () => {
    if (!canSave) {
      Alert.alert('알림', '제목과 내용을 입력해주세요.');
      return;
    }

    try {
      setIsSaving(true);

      const uploadedPhotoUrls = await Promise.all(
        selectedImageUris.map(async (imageUri) => {
          if (imageUri.startsWith('http')) {
            return imageUri;
          }

          const uploaded = await uploadPhoto(imageUri);
          return uploaded.photo_url;
        }),
      );

      if (!blogId) {
  Alert.alert('오류', '저장할 글 정보가 없습니다.');
  return;
}

await updateBlog(blogId, {
  title: journalTitle,
  content: journalContent,
  photoUrls: uploadedPhotoUrls,
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
          placeholderTextColor={Colors.textTertiary}
          textAlign="center"
        />

        <TouchableOpacity
          className="w-full h-[210px] bg-[#F2F2F2] justify-center items-center mb-5"
          onPress={handleImageAddPress}
        >
          <Text className="text-sm text-tertiary">사진 추가</Text>
        </TouchableOpacity>

        {selectedImageUris.map((imageUri) => (
          <View key={imageUri} className="w-full mb-5">
            <Image
              source={{uri: imageUri}}
              className="w-full h-[250px]"
              resizeMode="cover"
            />

            <TouchableOpacity
              className="mt-2 self-center"
              onPress={() => handleImageDeletePress(imageUri)}
            >
              <Text className="text-xs text-tertiary">사진 삭제</Text>
            </TouchableOpacity>
          </View>
        ))}

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