import {useState} from 'react';
import {
  Alert,
  Image,
  Modal,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import {File, Paths} from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import {type TimelinePlace} from '@/services/calendarApi';
import {buildStaticMapUrl} from '@/utils/staticMapUrl';

/**
 * 공유는 `expo-file-system` + `expo-sharing`으로 한다.
 * 예전에 쓰던 `RNFetchBlob`은 네이티브 전용이라 Expo 웹 번들을 깨뜨렸는데,
 * Expo 모듈은 웹에서도 import가 되므로 `Platform.OS` 가드가 필요 없다.
 * 대신 실제 지원 여부는 `Sharing.isAvailableAsync()`로 확인한다.
 */
const SHARE_FILE_NAME = 'map_share.png';

type Props = {
  places: TimelinePlace[];
};

const PREVIEW_W = 600;
const PREVIEW_H = 200;
const SAVE_W = 360;
const SAVE_H = 640;

export default function MapPreview({places}: Props) {
  const previewUrl = buildStaticMapUrl(places, PREVIEW_W, PREVIEW_H);
  const saveUrl = buildStaticMapUrl(places, SAVE_W, SAVE_H, 2);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    if (!saveUrl || sharing) return;
    setSharing(true);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('공유할 수 없어요', '이 기기에서는 공유가 지원되지 않아요.');
        return;
      }

      // 캐시에 같은 이름이 남아 있으면 다운로드가 실패한다 — 매번 새로 받는다
      const target = new File(Paths.cache, SHARE_FILE_NAME);
      if (target.exists) target.delete();

      const file = await File.downloadFileAsync(saveUrl, target);
      await Sharing.shareAsync(file.uri, {
        mimeType: 'image/png',
        UTI: 'public.png',
      });
    } catch {
      Alert.alert('공유 실패', '다시 시도해주세요.');
    } finally {
      setSharing(false);
    }
  };

  if (!previewUrl || loadFailed) {
    return (
      <View className="mx-4 mb-4 rounded-[14px] overflow-hidden h-[180px] bg-teal items-center justify-center">
        <Text className="text-sm text-secondary mb-1">
          지도를 불러올 수 없어요
        </Text>
        <Text className="text-[11px] text-tertiary">잠시 후 다시 열어주세요</Text>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.7}
        onLongPress={() => setShowModal(true)}
        delayLongPress={500}
        className="mx-8 mb-4 rounded-[14px] overflow-hidden h-[180px]"
      >
        <Image
          source={{uri: previewUrl}}
          className="flex-1"
          resizeMode="cover"
          onError={() => setLoadFailed(true)}
        />
      </TouchableOpacity>

      <Modal visible={showModal} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setShowModal(false)}>
          <View
            className="flex-1 items-center justify-center"
            style={{backgroundColor: 'rgba(0,0,0,0.7)'}}
          >
            <TouchableWithoutFeedback>
              <View className="w-[85%] rounded-2xl overflow-hidden bg-surface">
                <View style={{aspectRatio: 9 / 16}}>
                  <Image
                    source={{uri: saveUrl ?? ''}}
                    className="flex-1"
                    resizeMode="cover"
                  />
                </View>
                <View className="flex-row border-t border-line">
                  <TouchableOpacity
                    className="flex-1 items-center py-4"
                    onPress={() => setShowModal(false)}
                  >
                    <Text className="text-secondary">닫기</Text>
                  </TouchableOpacity>
                  <View className="w-px bg-line" />
                  <TouchableOpacity
                    className="flex-1 items-center py-4"
                    onPress={handleShare}
                    disabled={sharing}
                  >
                    {/* 진행 중이라고 글자를 바꾸지 말 것 — 길이가 변하면
                        버튼 높이가 밀려 모달 아래쪽이 들썩인다. 색만 바꾼다 */}
                    <Text
                      className={
                        sharing ? 'text-muted' : 'font-medium text-primary'
                      }
                    >
                      공유
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}
