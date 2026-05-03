import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import {
  generateJournal,
  uploadPhoto,
  WritingStyle,
} from '../lib/journalApi';

export default function WriteScreen() {
  const router = useRouter();

  const [writingStyle, setWritingStyle] = useState<WritingStyle>('info');
  const [prompt, setPrompt] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const canSubmit = prompt.trim().length > 0;

  const handleHomePress = () => {
    Alert.alert('작성 취소', '글쓰기를 취소하고 홈으로 이동할까요?', [
      { text: '계속 작성', style: 'cancel' },
      {
        text: '이동',
        style: 'destructive',
        onPress: () => router.replace('/(tabs)'),
      },
    ]);
  };

  const handleImagePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

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

      const generatedJournal = await generateJournal({
        prompt,
        writingStyle,
        photoId,
      });

      router.push({
        pathname: '/write-preview',
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
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>로미가 열심히 적고 있어요.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.dateText}>26.04.20</Text>

          <TouchableOpacity onPress={handleHomePress}>
            <Text style={styles.homeText}>Home</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              writingStyle === 'info' && styles.activeTabButton,
            ]}
            onPress={() => setWritingStyle('info')}
          >
            <Text style={styles.tabText}>정보 위주</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              writingStyle === 'emotion' && styles.activeTabButton,
            ]}
            onPress={() => setWritingStyle('emotion')}
          >
            <Text style={styles.tabText}>감성적</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <TextInput
            style={styles.promptInput}
            value={prompt}
            onChangeText={setPrompt}
            multiline
            placeholder="내용을 입력하세요"
            placeholderTextColor="#C7C7C7"
            textAlignVertical="top"
          />

          {imageUri && (
            <TouchableOpacity onPress={handleImagePick}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
            </TouchableOpacity>
          )}
        </ScrollView>

        <View style={styles.bottomBar}>
          <View style={styles.photoRow}>
            <Switch value={hasPhoto} onValueChange={handlePhotoToggle} />
            <Text style={styles.photoText}>사진</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.writeButton,
              !canSubmit && styles.disabledWriteButton,
            ]}
            onPress={handleWritePress}
            disabled={!canSubmit}
          >
            <Text style={styles.writeButtonText}>글쓰기</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
  },
  homeText: {
    fontSize: 12,
    color: '#C7C7C7',
    marginTop: 6,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 22,
    height: 34,
    backgroundColor: '#EAF3F2',
    borderRadius: 7,
    padding: 2,
  },
  tabButton: {
    flex: 1,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeTabButton: {
    backgroundColor: '#FFFFFF',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#222',
  },
  content: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 18,
  },
  promptInput: {
    minHeight: 260,
    fontSize: 14,
    lineHeight: 22,
    color: '#222',
  },
  previewImage: {
    width: '100%',
    height: 210,
    borderRadius: 10,
    marginTop: 18,
  },
  bottomBar: {
    height: 72,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  photoText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#222',
    fontWeight: '600',
  },
  writeButton: {
    backgroundColor: '#EDEDED',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 6,
  },
  disabledWriteButton: {
    opacity: 0.5,
  },
  writeButtonText: {
    fontSize: 12,
    color: '#222',
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 14,
    fontSize: 14,
    color: '#999',
  },
});