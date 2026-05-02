/**
 * @file components/bottomsheet/MapPreview.tsx
 * @description 바텀시트 expanded 상태에서 표시되는 정적 지도 이미지
 * - Kakao Static Map REST API 사용
 * - 모든 마커가 한 시야에 들어오도록 level & center 자동 계산
 *
 * ## 다음 연결 작업
 * - [ ] 마커 탭 시 해당 PostCard 하이라이트 연동
 */

import {useState} from 'react';
import {Image, View, Text, StyleSheet} from 'react-native';

import {type TimelinePlace} from '@/services/calendarApi';
import {Colors} from '@/constants/Colors';

const KAKAO_REST_API_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY ?? '';

type Props = {
  places: TimelinePlace[];
};

const MAP_WIDTH = 600;
const MAP_HEIGHT = 200;

/**
 * Mercator 투영 기반 zoom 계산 후 Kakao level로 변환
 * Kakao level = 18 - zoom (level이 낮을수록 확대)
 * 결과값은 1~14 사이로 제한
 */
function calcKakaoLevel(
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
  const lngFraction =
    (maxLng - minLng + (maxLng < minLng ? 360 : 0)) / 360;

  const latZoom = Math.floor(
    Math.log(MAP_HEIGHT / WORLD_PX / latFraction) / Math.LN2,
  );
  const lngZoom = Math.floor(
    Math.log(MAP_WIDTH / WORLD_PX / lngFraction) / Math.LN2,
  );

  const zoom = Math.min(latZoom, lngZoom, 16) - 1; // -1: 마커 가장자리 여백
  const level = Math.min(Math.max(18 - zoom, 1), 14);
  return level;
}

/**
 * Kakao Static Map REST API URL 생성
 * endpoint: dapi.kakao.com/v2/maps/staticmap
 * 인증: Authorization 헤더 (KakaoAK {REST_API_KEY}) — Image source headers로 전달
 * 좌표 순서: 경도(lng),위도(lat) — Kakao는 lng,lat 순서
 * 마커 형식: {lng},{lat},{label} (쉼표 구분, 파이프로 다중 마커)
 */
function buildStaticMapUrl(places: TimelinePlace[]): string | null {
  if (!KAKAO_REST_API_KEY) return null;

  if (places.length === 0) {
    return (
      `https://dapi.kakao.com/v2/maps/static.png` +
      `?center=126.9780,37.5665` +
      `&level=8` +
      `&w=${MAP_WIDTH}&h=${MAP_HEIGHT}`
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
  const level =
    places.length === 1
      ? 3
      : calcKakaoLevel(minLat, maxLat, minLng, maxLng);

  const markers = places
    .map(p => `${p.lng},${p.lat}`)
    .join('|');

  return (
    `https://dapi.kakao.com/v2/maps/static.png` +
    `?center=${centerLng},${centerLat}` +
    `&level=${level}` +
    `&w=${MAP_WIDTH}&h=${MAP_HEIGHT}` +
    `&markers=${encodeURIComponent(markers)}`
  );
}

export default function MapPreview({places}: Props) {
  const url = buildStaticMapUrl(places);
  const [loadFailed, setLoadFailed] = useState(false);

  if (!url || loadFailed) {
    return (
      <View style={[styles.container, styles.placeholder]}>
        <Text style={styles.placeholderText}>API 키 설정 안됨</Text>
        <Text style={styles.placeholderSub}>
          .env › EXPO_PUBLIC_KAKAO_REST_API_KEY
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image
        source={{uri: url, headers: {Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`}}}
        style={styles.image}
        resizeMode="cover"
        onError={() => setLoadFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 14,
    overflow: 'hidden',
    height: 180,
  },
  image: {
    flex: 1,
  },
  placeholder: {
    backgroundColor: Colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  placeholderSub: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
});
