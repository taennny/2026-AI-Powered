/**
 * 장소 수정·삭제. **백엔드 엔드포인트가 아직 없다** — 경로와 형식은 합의한 스펙이고,
 * 붙기 전까지 호출하면 404다(화면은 실패 문구를 띄운다).
 */

import {api} from '@/utils/api';

export type PlaceCandidate = {
  name: string;
  category: string | null;
  /** 체류 중심점에서의 거리(m). 대략값 */
  distance_m: number;
  /** 국내(카카오)에서만 온다 */
  kakao_place_id?: string | null;
};

/** GET /api/v1/places/{id}/candidates — 좌표 기준 주변 후보 (AI가 고른 장소는 제외) */
export async function fetchPlaceCandidates(
  placeId: string,
): Promise<PlaceCandidate[]> {
  const {data} = await api.get<{candidates: PlaceCandidate[]}>(
    `/api/v1/places/${placeId}/candidates`,
  );
  return data.candidates;
}

/** GET /api/v1/places/{id}/candidates?q= — 같은 좌표에서 이름 부분 일치 검색 */
export async function searchPlaceCandidates(
  placeId: string,
  query: string,
): Promise<PlaceCandidate[]> {
  const {data} = await api.get<{candidates: PlaceCandidate[]}>(
    `/api/v1/places/${placeId}/candidates`,
    {params: {q: query}},
  );
  return data.candidates;
}

export type UpdatePlaceRequest = {
  name: string;
  category?: string | null;
  /** 후보에서 고른 경우에만. 좌표는 보내지 않는다 — 핀은 GPS 중심점을 유지한다 */
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
