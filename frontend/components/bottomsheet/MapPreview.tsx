import {useState} from 'react';
import {
  Image,
  Modal,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import {type TimelinePlace} from '@/services/calendarApi';
import {buildStaticMapUrl} from '@/utils/staticMapUrl';

// TODO(공유 기능): RNFetchBlob이 네이티브 전용이라 Expo 웹에서 번들이 깨짐.
// 사용할 땐 handleShare 주석 해제 + Alert·Sharing·RNFetchBlob import 복구 + Platform.OS 가드 필

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

  /*const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    if (!saveUrl || sharing) return;
    setSharing(true);
    try {
      const res = await RNFetchBlob.config({
        fileCache: true,
        appendExt: 'png',
        path: RNFetchBlob.fs.dirs.CacheDir + '/map_share.png', // 추가
      }).fetch('GET', saveUrl);
      await Sharing.shareAsync(`file://${res.path()}`, {
        mimeType: 'image/png',
        UTI: 'public.png',
      });
      await res.flush();
    } catch {
      Alert.alert('공유 실패', '다시 시도해주세요.');
    } finally {
      setSharing(false);
    }
  };*/

  if (!previewUrl || loadFailed) {
    return (
      <View className="mx-4 mb-4 rounded-[14px] overflow-hidden h-[180px] bg-teal items-center justify-center">
        <Text className="text-sm text-secondary mb-1">
          지도를 불러올 수 없어요
        </Text>
        <Text className="text-[11px] text-tertiary">
          .env › EXPO_PUBLIC_GOOGLE_MAPS_KEY
        </Text>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.9}
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
                  {/*<TouchableOpacity
                    className="flex-1 items-center py-4"
                    onPress={handleShare}
                    disabled={sharing}
                  >
                    <Text
                      className={
                        sharing ? 'text-muted' : 'font-medium text-primary'
                      }
                    >
                      공유
                    </Text>
                  </TouchableOpacity>*/}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}
