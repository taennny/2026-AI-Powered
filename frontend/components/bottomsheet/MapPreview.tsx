/**
 * @file components/bottomsheet/MapPreview.tsx
 * @description 바텀시트 expanded 상태에서 표시되는 정적 지도 이미지
 * - Google Static Maps API 사용
 * - 모든 마커가 한 시야에 들어오도록 zoom & center 자동 계산
 * - 꾹 누르면 3:4 비율 미리보기 모달 → 공유
 */

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
import RNFetchBlob from 'react-native-blob-util';
import * as Sharing from 'expo-sharing';

import {type TimelinePlace} from '@/services/calendarApi';

const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '';

type Props = {
  places: TimelinePlace[];
};

const PREVIEW_W = 600;
const PREVIEW_H = 200;
const SAVE_W = 360;
const SAVE_H = 640;

function calcZoom(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
  w: number,
  h: number,
): number {
  const WORLD_PX = 256;

  const latRad = (lat: number) => {
    const sin = Math.sin((lat * Math.PI) / 180);
    const rad = Math.log((1 + sin) / (1 - sin)) / 2;
    return Math.max(Math.min(rad, Math.PI), -Math.PI) / 2;
  };

  const latFraction = (latRad(maxLat) - latRad(minLat)) / Math.PI;
  const lngFraction = (maxLng - minLng + (maxLng < minLng ? 360 : 0)) / 360;

  const latZoom = Math.floor(Math.log(h / WORLD_PX / latFraction) / Math.LN2);
  const lngZoom = Math.floor(Math.log(w / WORLD_PX / lngFraction) / Math.LN2);

  return Math.min(latZoom, lngZoom, 16) - 1;
}

function buildUrl(
  places: TimelinePlace[],
  w: number,
  h: number,
  scale = 1,
): string | null {
  if (!GOOGLE_MAPS_KEY) return null;

  if (places.length === 0) {
    return (
      `https://maps.googleapis.com/maps/api/staticmap` +
      `?center=37.5665,126.9780&zoom=12` +
      `&size=${w}x${h}` +
      `&scale=${scale}` +
      `&key=${GOOGLE_MAPS_KEY}`
    );
  }

  const lats = places.map(p => p.lat);
  const lngs = places.map(p => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  const zoom =
    places.length === 1 ? 15 : calcZoom(minLat, maxLat, minLng, maxLng, w, h);

  const markers = places
    .map(p => `color:red|${p.lat},${p.lng}`)
    .join('&markers=');

  return (
    `https://maps.googleapis.com/maps/api/staticmap` +
    `?center=${centerLat},${centerLng}` +
    `&zoom=${zoom}` +
    `&size=${w}x${h}` +
    `&scale=${scale}` +
    `&markers=${markers}` +
    `&key=${GOOGLE_MAPS_KEY}`
  );
}

export default function MapPreview({places}: Props) {
  const previewUrl = buildUrl(places, PREVIEW_W, PREVIEW_H);
  const saveUrl = buildUrl(places, SAVE_W, SAVE_H, 2);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    if (!saveUrl || sharing) return;
    setSharing(true);
    try {
      const res = await RNFetchBlob.config({
        fileCache: true,
        appendExt: 'png',
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
  };

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
                  <TouchableOpacity
                    className="flex-1 items-center py-4"
                    onPress={handleShare}
                    disabled={sharing}
                  >
                    <Text className={sharing ? 'text-muted' : 'font-medium text-primary'}>
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
