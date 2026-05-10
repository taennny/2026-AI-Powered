/**
 * @file components/bottomsheet/MapPreview.tsx
 * @description 바텀시트 expanded 상태에서 표시되는 정적 지도 이미지
 * - Google Static Maps API 사용
 * - 모든 마커가 한 시야에 들어오도록 zoom & center 자동 계산
 *
 * ## 다음 연결 작업
 * - [ ] 마커 탭 시 해당 PostCard 하이라이트 연동
 */

import {useState} from 'react';
import {Image, View, Text} from 'react-native';

import {type TimelinePlace} from '@/services/calendarApi';

const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '';

type Props = {
  places: TimelinePlace[];
};

const MAP_WIDTH = 600;
const MAP_HEIGHT = 200;

function calcZoom(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
): number {
  const WORLD_PX = 256;

  const latRad = (lat: number) => {
    const sin = Math.sin((lat * Math.PI) / 180);
    const rad = Math.log((1 + sin) / (1 - sin)) / 2;
    return Math.max(Math.min(rad, Math.PI), -Math.PI) / 2;
  };

  const latFraction = (latRad(maxLat) - latRad(minLat)) / Math.PI;
  const lngFraction = (maxLng - minLng + (maxLng < minLng ? 360 : 0)) / 360;

  const latZoom = Math.floor(
    Math.log(MAP_HEIGHT / WORLD_PX / latFraction) / Math.LN2,
  );
  const lngZoom = Math.floor(
    Math.log(MAP_WIDTH / WORLD_PX / lngFraction) / Math.LN2,
  );

  return Math.min(latZoom, lngZoom, 16) - 1;
}

function buildStaticMapUrl(places: TimelinePlace[]): string | null {
  if (!GOOGLE_MAPS_KEY) return null;

  if (places.length === 0) {
    return (
      `https://maps.googleapis.com/maps/api/staticmap` +
      `?center=37.5665,126.9780&zoom=12` +
      `&size=${MAP_WIDTH}x${MAP_HEIGHT}` +
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
    places.length === 1 ? 15 : calcZoom(minLat, maxLat, minLng, maxLng);

  const markers = places
    .map(p => `color:red|${p.lat},${p.lng}`)
    .join('&markers=');

  return (
    `https://maps.googleapis.com/maps/api/staticmap` +
    `?center=${centerLat},${centerLng}` +
    `&zoom=${zoom}` +
    `&size=${MAP_WIDTH}x${MAP_HEIGHT}` +
    `&markers=${markers}` +
    `&key=${GOOGLE_MAPS_KEY}`
  );
}

export default function MapPreview({places}: Props) {
  const url = buildStaticMapUrl(places);
  const [loadFailed, setLoadFailed] = useState(false);

  if (!url || loadFailed) {
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
    <View className="mx-4 mb-4 rounded-[14px] overflow-hidden h-[180px]">
      <Image
        source={{uri: url}}
        className="flex-1"
        resizeMode="cover"
        onError={() => setLoadFailed(true)}
      />
    </View>
  );
}
