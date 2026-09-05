/**
 * 그날 찍은 사진을 조용히 올린다 — 서버가 `arrived_at ≤ taken_at ≤ left_at`으로
 * 장소에 붙여 타임라인 카드에 띄운다.
 *
 * "보는 날짜만" 올린다 — 사진 한 장이 3~5MB라 과거를 한꺼번에 훑으면 수 GB다.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type * as MediaLibraryTypes from 'expo-media-library';

import {uploadPhoto} from '@/services/photoApi';
import {DAY_BOUNDARY_HOUR} from '@/utils/formatDate';

/**
 * 네이티브 모듈은 함수 안에서 늦게 가져온다 — 최상단 import는 모듈이 없을 때
 * (재빌드 전, 웹) 파일 전체를 못 읽게 만들어 무관한 화면까지 깨뜨린다.
 */
function loadNativeModules(): {
  MediaLibrary: typeof MediaLibraryTypes;
  Network: typeof import('expo-network');
} | null {
  try {
    return {
      MediaLibrary: require('expo-media-library'),
      Network: require('expo-network'),
    };
  } catch {
    return null;
  }
}

/** 이미 올린 asset id 목록 */
const UPLOADED_IDS_KEY = 'photos:uploadedAssetIds';

/** 한 번에 올리는 최대 장수 — 하루에 수백 장을 찍어도 앱이 묶이지 않게 */
const MAX_PER_RUN = 20;

/** 한 날짜에서 훑어볼 최대 장수 */
const MAX_SCAN = 200;

/** 기록해 두는 id 개수 상한. 오래된 것부터 버린다 */
const MAX_TRACKED_IDS = 2000;

/** 같은 날짜를 다시 훑기까지의 최소 간격 */
export const SYNC_MIN_INTERVAL_MS = 5 * 60 * 1000;

/** 날짜별 마지막 실행 시각 — 오늘을 올린 뒤 과거 날짜를 열어도 막히지 않게 */
const lastSyncedAt = new Map<string, number>();
let isSyncing = false;

async function readUploadedIds(): Promise<Set<string> | null> {
  try {
    const raw = await AsyncStorage.getItem(UPLOADED_IDS_KEY);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    // 빈 Set으로 진행하면 이미 올린 사진을 전부 다시 올린다
    return null;
  }
}

async function writeUploadedIds(ids: Set<string>): Promise<void> {
  try {
    const list = [...ids].slice(-MAX_TRACKED_IDS);
    await AsyncStorage.setItem(UPLOADED_IDS_KEY, JSON.stringify(list));
  } catch {
    // 다음 회차에 한 번 더 올리는 정도의 손해다
  }
}

/** 셀룰러로 수백 MB를 올리면 안 된다. 확인이 안 되면 올리지 않는다 */
async function isOnWifi(Network: typeof import('expo-network')): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return state.type === Network.NetworkStateType.WIFI;
  } catch {
    return false;
  }
}

/** 'YYYY-MM-DD' → 그 논리적 하루의 시작·끝 (기기 로컬 새벽 4시 기준) */
function logicalDayRange(dateKey: string): {start: Date; end: Date} | null {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return null;

  const start = new Date(y, m - 1, d, DAY_BOUNDARY_HOUR);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return {start, end};
}

/**
 * 촬영 시각이 없으면 올리지 않는다 — 서버가 업로드 시각으로 저장해
 * "지금 있는 장소"에 엉뚱하게 붙는다 (스크린샷·저장한 이미지가 여기 해당).
 * EXIF 구조가 플랫폼마다 달라 평탄·중첩 형태를 모두 본다.
 */
function hasCaptureTime(info: MediaLibraryTypes.AssetInfo): boolean {
  const exif = info.exif as Record<string, unknown> | undefined;
  if (!exif) return false;

  // iOS는 CGImage 속성 딕셔너리를 그대로 넘겨 키가 '{Exif}'다(중괄호 포함).
  // 안드로이드는 평탄한 구조. 둘 다 못 찾으면 사진이 통째로 안 올라간다
  const nested = (exif['{Exif}'] ?? exif.Exif) as
    | Record<string, unknown>
    | undefined;

  return Boolean(exif.DateTimeOriginal ?? nested?.DateTimeOriginal);
}

/**
 * 권한 확인만 하고 요청하지는 않는다 — 요청은 `usePermissions`의 몫이다.
 *
 * @returns 실제로 올린 장수 (0이면 화면을 갱신할 이유가 없다)
 */
export async function syncPhotosForDate(
  dateKey: string,
  now = Date.now(),
): Promise<number> {
  if (isSyncing) return 0;

  const last = lastSyncedAt.get(dateKey) ?? 0;
  if (now - last < SYNC_MIN_INTERVAL_MS) return 0;

  const range = logicalDayRange(dateKey);
  if (!range) return 0;

  // 네이티브 모듈이 없으면(재빌드 전, 웹) 사진 동기화만 조용히 건너뛴다
  const native = loadNativeModules();
  if (!native) return 0;
  const {MediaLibrary, Network} = native;

  // 권한·네트워크 확인 뒤에 잠그면 동시 호출이 둘 다 통과해 두 번 올린다
  isSyncing = true;
  lastSyncedAt.set(dateKey, now);

  try {
    const {status} = await MediaLibrary.getPermissionsAsync();
    if (status !== 'granted') {
      // 간격을 소진시키지 않는다 — 설정에서 켜고 오면 바로 재시도
      lastSyncedAt.delete(dateKey);
      return 0;
    }

    if (!(await isOnWifi(Network))) {
      lastSyncedAt.delete(dateKey);
      return 0;
    }

    const {assets} = await MediaLibrary.getAssetsAsync({
      mediaType: 'photo',
      createdAfter: range.start,
      createdBefore: range.end,
      // 오름차순 — 상한에 걸리면 늦게 찍은 것이 잘린다 (첫 사진이 더 자연스럽다)
      sortBy: [['creationTime', true]],
      first: MAX_SCAN,
    });

    const uploadedIds = await readUploadedIds();
    if (uploadedIds === null) return 0;

    const targets = assets
      .filter(a => !uploadedIds.has(a.id))
      .slice(0, MAX_PER_RUN);

    if (targets.length === 0) return 0;

    const knownBefore = uploadedIds.size;
    let uploaded = 0;
    for (const asset of targets) {
      try {
        // iOS의 asset.uri는 ph:// 라 그대로 못 올린다 — localUri가 필요하다
        const info = await MediaLibrary.getAssetInfoAsync(asset);

        if (!hasCaptureTime(info)) {
          // 다음 회차에 EXIF를 또 읽지 않도록 기록해 둔다
          uploadedIds.add(asset.id);
          continue;
        }

        const uri = info.localUri ?? asset.uri;

        await uploadPhoto(uri, asset.filename);
        uploadedIds.add(asset.id);
        uploaded += 1;
      } catch {
        // 성공한 것만 기록되므로 실패한 사진은 다음 회차에 재시도된다
      }
    }

    // 건너뛴 것도 기록됐다 — 저장 안 하면 다음 회차에 EXIF를 또 읽는다
    if (uploadedIds.size > knownBefore) await writeUploadedIds(uploadedIds);
    return uploaded;
  } catch {
    // 간격을 소진시키지 않고 다음 기회에 재시도한다
    lastSyncedAt.delete(dateKey);
    return 0;
  } finally {
    isSyncing = false;
  }
}

/** 로그아웃 시 — 다음 계정이 물려받으면 안 된다 */
export async function clearPhotoSyncState(): Promise<void> {
  lastSyncedAt.clear();
  try {
    await AsyncStorage.removeItem(UPLOADED_IDS_KEY);
  } catch {
    // 다음 계정에서 한 번 더 올라갈 뿐이다
  }
}

/** 테스트 전용 — 모듈 상태 초기화 */
export function __resetPhotoSync(): void {
  lastSyncedAt.clear();
  isSyncing = false;
}
