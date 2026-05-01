import React, { useState } from 'react';
import {
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { saveJournal } from '../lib/journalApi';

export default function WritePreviewScreen() {
  const router = useRouter();

  const { title, content, photoUrl } = useLocalSearchParams<{
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
      { text: '계속 수정', style: 'cancel' },
      {
        text: '취소',
        style: 'destructive',
        onPress: () => router.replace('/(tabs)'),
      },
    ]);
  };

  const handleImageChangePress = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

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

      await saveJournal({
        title: journalTitle,
        content: journalContent,
        photoUrl: selectedImageUri || undefined,
      });

      Alert.alert('완료', '글이 저장되었습니다.', [
        {
          text: '확인',
          onPress: () => router.replace('/(tabs)'),
        },
      ]);
    } catch {
      Alert.alert('오류', '저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancelPress}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSavePress}
          disabled={!canSave || isSaving}
        >
          <Text
            style={[
              styles.saveText,
              (!canSave || isSaving) && styles.disabledSaveText,
            ]}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <TextInput
          style={styles.titleInput}
          value={journalTitle}
          onChangeText={setJournalTitle}
          placeholder="제목"
          placeholderTextColor="#BDBDBD"
          textAlign="center"
        />

        {selectedImageUri ? (
          <View style={styles.imageWrapper}>
            <TouchableOpacity onPress={handleImageChangePress}>
              <Image source={{ uri: selectedImageUri }} style={styles.image} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteImageButton}
              onPress={handleImageDeletePress}
            >
              <Text style={styles.deleteImageText}>사진 삭제</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.emptyImageBox}
            onPress={handleImageChangePress}
          >
            <Text style={styles.emptyImageText}>사진 추가</Text>
          </TouchableOpacity>
        )}

        <TextInput
          style={styles.contentInput}
          value={journalContent}
          onChangeText={setJournalContent}
          multiline
          placeholder="내용"
          placeholderTextColor="#BDBDBD"
          textAlign="center"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelText: {
    fontSize: 12,
    color: '#BDBDBD',
  },
  saveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#222',
  },
  disabledSaveText: {
    color: '#CFCFCF',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  titleInput: {
    width: '90%',
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 16,
    padding: 0,
  },
  imageWrapper: {
    width: '100%',
    marginBottom: 20,
  },
  image: {
    width: '100%',
    height: 250,
  },
  deleteImageButton: {
    marginTop: 8,
    alignSelf: 'center',
  },
  deleteImageText: {
    fontSize: 12,
    color: '#999',
  },
  emptyImageBox: {
    width: '100%',
    height: 210,
    backgroundColor: '#F2F2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyImageText: {
    fontSize: 13,
    color: '#999',
  },
  contentInput: {
    width: '90%',
    minHeight: 160,
    fontSize: 14,
    lineHeight: 22,
    color: '#222',
  },
});