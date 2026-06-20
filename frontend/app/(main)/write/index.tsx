/** @file app/(main)/write/index.tsx — 프롬프트 입력 + AI 글 생성 화면 */

import React, {useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {useRouter} from 'expo-router';
import {generateJournal, uploadPhoto, WritingStyle} from '@/services/journalApi';
import {Colors} from '@/constants/Colors';

export default function WriteScreen() {
  const router = useRouter();

  const [writingStyle, setWritingStyle] = useState<WritingStyle>('info');
  const [prompt, setPrompt] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const dateStr = useMemo(() => {
    const today = new Date();
    const yy = String(today.getFullYear()).slice(2);
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yy}.${mm}.${dd}`;
  }, []);

  const canSubmit = prompt.trim().length > 0;

  const handleHomePress = () => {
    Alert.alert('작성 취소', '글쓰기를 취소하고 홈으로 이동할까요?', [
      {text: '계속 작성', style: 'cancel'},
      {text: '이동', style: 'destructive', onPress: () => router.replace('/(main)/(tabs)/home')},
    ]);
  };

  const handleImagePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({mediaTypes: ['images'], quality: 0.8});
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      setHasPhoto(true);
    } else {
      setHasPhoto(false);
    }
  };

  const handlePhotoToggle = async (value: boolean) => {
    if (value) {
      await handleImagePick();
      return;
    }
    setHasPhoto(false);
    setImageUri(null);
  };

  const handleWritePress = async () => {
    if (!canSubmit) {
      Alert.alert('알림', '내용을 입력해야 글을 생성할 수 있습니다.');
      return;
    }
    try {
      setIsLoading(true);
      let photoId: string | undefined;
      let photoUrl: string | undefined;
      if (imageUri) {
        const uploadedPhoto = await uploadPhoto(imageUri);
        photoId = uploadedPhoto.photo_id;
        photoUrl = uploadedPhoto.photo_url;
      }
      const generatedJournal = await generateJournal({prompt, writingStyle, photoId});
      router.push({
        pathname: '/(main)/write-preview',
        params: {
          title: generatedJournal.title,
          content: generatedJournal.content,
          photoUrl: generatedJournal.photoUrl || photoUrl || '',
        },
      });
    } catch {
      Alert.alert('오류', '글 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface justify-center items-center">
        <ActivityIndicator size="large" />
        <Text className="mt-[14px] text-sm text-tertiary">로미가 열심히 적고 있어요.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* 헤더 */}
        <View className="px-[22px] pt-4 pb-[10px] flex-row justify-between">
          <Text className="text-xl font-bold text-primary">{dateStr}</Text>
          <TouchableOpacity onPress={handleHomePress}>
            <Text className="text-xs text-muted mt-[6px]">Home</Text>
          </TouchableOpacity>
        </View>

        {/* 글쓰기 스타일 탭 */}
        <View className="flex-row mx-[22px] h-[34px] bg-teal-bg rounded-[7px] p-0.5">
          <TouchableOpacity
            className={`flex-1 rounded-md justify-center items-center${writingStyle === 'info' ? ' bg-white' : ''}`}
            onPress={() => setWritingStyle('info')}
          >
            <Text className="text-xs font-semibold text-primary">정보 위주</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 rounded-md justify-center items-center${writingStyle === 'emotion' ? ' bg-white' : ''}`}
            onPress={() => setWritingStyle('emotion')}
          >
            <Text className="text-xs font-semibold text-primary">감성적</Text>
          </TouchableOpacity>
        </View>

        {/* 입력 영역 */}
        <ScrollView className="flex-1 px-[22px] pt-[18px]">
          <TextInput
            className="text-sm text-primary leading-[22px]"
            style={{minHeight: 260, textAlignVertical: 'top'}}
            value={prompt}
            onChangeText={setPrompt}
            multiline
            placeholder="내용을 입력하세요"
            placeholderTextColor={Colors.textTertiary}
            textAlignVertical="top"
          />
          {imageUri && (
            <TouchableOpacity onPress={handleImagePick}>
              <Image
                source={{uri: imageUri}}
                className="w-full h-[210px] rounded-[10px] mt-[18px]"
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* 하단 바 */}
        <View className="h-[72px] border-t border-line bg-surface px-[22px] flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Switch value={hasPhoto} onValueChange={handlePhotoToggle} />
            <Text className="ml-2 text-xs font-semibold text-primary">사진</Text>
          </View>
          <TouchableOpacity
            className={`bg-[#EDEDED] px-[22px] py-[10px] rounded-md${!canSubmit ? ' opacity-50' : ''}`}
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
