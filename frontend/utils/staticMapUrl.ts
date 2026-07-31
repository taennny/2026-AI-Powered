/** Google Static Maps URL 생성 — 모든 마커가 한 시야에 들어오도록 zoom·center를 계산한다 */

import {type TimelinePlace} from '@/services/calendarApi';

const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '';

const BASE = 'https://maps.googleapis.com/maps/api/staticmap';

const FALLBACK_CENTER = '37.5665,126.9780';
const FALLBACK_ZOOM = 12;

/** 마커 하나뿐이면 bounds를 계산할 수 없으므로 고정 줌을 쓴다. */
const SINGLE_PLACE_ZOOM = 15;

const WORLD_PX = 256;
const MAX_ZOOM = 16;

function latRad(lat: number): number {
  const sin = Math.sin((lat * Math.PI) / 180);
  const rad = Math.log((1 + sin) / (1 - sin)) / 2;
  return Math.max(Math.min(rad, Math.PI), -Math.PI) / 2;
}

export function calcZoom(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
  w: number,
  h: number,
): number {
  const latFraction = (latRad(maxLat) - latRad(minLat)) / Math.PI;
  const lngFraction = (maxLng - minLng + (maxLng < minLng ? 360 : 0)) / 360;

  const latZoom = Math.floor(Math.log(h / WORLD_PX / latFraction) / Math.LN2);
  const lngZoom = Math.floor(Math.log(w / WORLD_PX / lngFraction) / Math.LN2);

  return Math.min(latZoom, lngZoom, MAX_ZOOM) - 1;
}

/** API 키가 없으면 null — 호출부에서 폴백 UI를 띄운다. */
export function buildStaticMapUrl(
  places: TimelinePlace[],
  w: number,
  h: number,
  scale = 1,
): string | null {
  if (!GOOGLE_MAPS_KEY) return null;

  const size = `&size=${w}x${h}&scale=${scale}&key=${GOOGLE_MAPS_KEY}`;

  if (places.length === 0) {
    return `${BASE}?center=${FALLBACK_CENTER}&zoom=${FALLBACK_ZOOM}${size}`;
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
    places.length === 1
      ? SINGLE_PLACE_ZOOM
      : calcZoom(minLat, maxLat, minLng, maxLng, w, h);

  const markers = places
    .map(p => `color:red|${p.lat},${p.lng}`)
    .join('&markers=');

  return `${BASE}?center=${centerLat},${centerLng}&zoom=${zoom}${size}&markers=${markers}`;
}
