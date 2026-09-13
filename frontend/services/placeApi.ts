/**
 * 장소 수정·삭제.
 *
 * 후보·검색은 **백엔드가 AI 서버(`/api/ai/candidates`, `/api/ai/search`)를 중계**한다.
 * 앱이 AI를 직접 부르지 않는 이유는 지도 API 키가 그쪽에 있기 때문이다.
 * 응답은 AI 형식 그대로 받는다 — 중간에서 필드명을 바꾸면 양쪽이 어긋난다.
 *
 * **백엔드 엔드포인트는 아직 없다.** 경로와 형식은 합의한 스펙이고, 붙기 전까지 404다.
 */

import {api} from '@/utils/api';

export type PlaceCandidate = {
  place_name: string;
  /** 카카오 `category_name` 원문 — `'음식점 > 카페 > 커피전문점'`처럼 계층 문자열이다 */
  category: string | null;
  address: string | null;
  /** 체류 중심점에서의 거리(m). 대략값 */
  distance_m: number;
  lat: number;
  lng: number;
  /** 카카오 place id. 해외(구글)는 형식이 다를 수 있다 */
  place_id: string | null;
};

/** 계층 문자열의 마지막 조각 — 목록에 전체를 쓰면 한 줄을 넘긴다 */
export function categoryLeaf(category: string | null): string | null {
  if (!category) return null;
  const leaf = category.split('>').pop()?.trim();
  return leaf || null;
}

/**
 * GET /api/v1/places/{id}/candidates
 * 백엔드가 place의 저장 좌표와 현재 이름을 `exclude`로 넘긴다 —
 * 지금 이름이 후보에 또 뜨면 "이거 아니다"라고 누른 사용자에게 이상하다.
 * 거리순 최대 5개.
 */
export async function fetchPlaceCandidates(
  placeId: string,
): Promise<PlaceCandidate[]> {
  const {data} = await api.get<{candidates: PlaceCandidate[]}>(
    `/api/v1/places/${placeId}/candidates`,
  );
  return data.candidates ?? [];
}

/**
 * GET /api/v1/places/{id}/search?q=
 * 같은 좌표에서 이름 부분 일치. 거리순 최대 10개.
 * 응답 키가 후보 조회(`candidates`)와 다르다 — AI 스펙 그대로다.
 */
export async function searchPlaceCandidates(
  placeId: string,
  query: string,
): Promise<PlaceCandidate[]> {
  const {data} = await api.get<{results: PlaceCandidate[]}>(
    `/api/v1/places/${placeId}/search`,
    {params: {q: query}},
  );
  return data.results ?? [];
}

export type UpdatePlaceRequest = {
  name: string;
  category?: string | null;
  /** 지도에서 고른 경우에만. 좌표는 보내지 않는다 — 핀은 GPS 중심점을 유지한다 */
  kakao_place_id?: string | null;
};

/** PATCH /api/v1/places/{id} — 서버가 is_corrected를 세운다 */
export async function updatePlace(
  placeId: string,
  body: UpdatePlaceRequest,
): Promise<void> {
  await api.patch(`/api/v1/places/${placeId}`, body);
}

/** DELETE /api/v1/places/{id} — 재분석에 되살아나지 않게 하는 건 서버 몫 */
export async function deletePlace(placeId: string): Promise<void> {
  await api.delete(`/api/v1/places/${placeId}`);
}
