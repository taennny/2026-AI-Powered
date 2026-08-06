/**
 * 그날 찍은 사진을 조용히 서버로 올린다.
 *
 * 사용자는 아무것도 하지 않는다. 사진이 서버에 있어야 백엔드가
 * `arrived_at ≤ taken_at ≤ left_at`으로 장소에 붙여주고(services/calendar.py),
 * 그 결과가 타임라인 응답의 `photos[]`로 내려와 카드에 뜬다.
 *
 * 호출 시점은 두 갈래다:
 *   - `hooks/usePhotoSync.ts` — 앱 진입·복귀 시 **오늘**
 *   - `hooks/useCalendar.ts`  — 캘린더에서 **고른 날짜**
 *
 * 과거를 한꺼번에 훑지 않는 이유: 사진 한 장이 3~5MB라 한 달치면 수 GB다.
 * 앱을 오래 안 켠 사용자가 앱을 열자마자 수 GB를 올리기 시작하면 사고다.
 * 대신 "보는 날짜만" 올리면 데이터 사용량이 사용자 행동에 비례한다.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type * as MediaLibraryTypes from 'expo-media-library';

import {uploadPhoto} from '@/services/photoApi';
import {DAY_BOUNDARY_HOUR} from '@/utils/formatDate';

type Asset = MediaLibraryTypes.Asset;

/**
 * 네이티브 모듈은 **함수 안에서 늦게** 가져온다.
 *
 * 최상단에서 import하면 모듈이 없을 때(재빌드 전, 웹 번들) 이 파일 전체가
 * 로드에 실패해 `syncPhotosForDate is not a function`으로 번지고, 사진과
 * 무관한 화면까지 에러를 뱉는다. 사진 동기화는 없어도 앱이 도는 부가 기능이니
 * 조용히 건너뛰는 편이 맞다.
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
    // 기록을 못 읽었는데 빈 Set으로 진행하면 이미 올린 사진을 전부 다시
    // 올려 중복이 쌓인다. 이번 회차를 건너뛰는 편이 낫다
    return null;
  }
}

async function writeUploadedIds(ids: Set<string>): Promise<void> {
  try {
    const list = [...ids].slice(-MAX_TRACKED_IDS);
    await AsyncStorage.setItem(UPLOADED_IDS_KEY, JSON.stringify(list));
  } catch {
    // 저장 실패는 다음 회차에 같은 사진을 한 번 더 올리는 정도의 손해다
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
 * 스크린샷·다운로드 이미지는 EXIF가 없어서 서버가 업로드 시각으로 저장한다.
 * 그러면 "지금 있는 장소"에 엉뚱하게 붙으므로 아예 올리지 않는다.
 */
function isCameraShot(asset: Asset): boolean {
  return !asset.mediaSubtypes?.includes('screenshot');
}

/**
 * 그 날짜에 찍은 사진 중 아직 안 올린 것을 올린다.
 *
 * 권한 확인은 여기서 한다(요청은 하지 않는다) — 권한 요청은 사용자가 예상하는
 * 시점에만 나가야 하고, 그건 `usePermissions`의 몫이다.
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

  const {status} = await MediaLibrary.getPermissionsAsync();
  if (status !== 'granted') return 0;

  if (!(await isOnWifi(Network))) return 0;

  isSyncing = true;
  lastSyncedAt.set(dateKey, now);

  try {
    const {assets} = await MediaLibrary.getAssetsAsync({
      mediaType: 'photo',
      createdAfter: range.start,
      createdBefore: range.end,
      // 오름차순 — 200장 상한에 걸리면 그날 늦게 찍은 것이 잘린다.
      // 카드에는 "도착해서 처음 찍은 사진"이 붙는 편이 자연스럽다
      sortBy: [['creationTime', true]],
      first: MAX_SCAN,
    });

    const uploadedIds = await readUploadedIds();
    if (uploadedIds === null) return 0;

    const targets = assets
      .filter(isCameraShot)
      .filter(a => !uploadedIds.has(a.id))
      .slice(0, MAX_PER_RUN);

    if (targets.length === 0) return 0;

    let uploaded = 0;
    for (const asset of targets) {
      try {
        // iOS의 asset.uri는 ph:// 스킴이라 그대로 업로드할 수 없다.
        // getAssetInfoAsync가 실제 파일 경로(localUri)를 준다.
        const info = await MediaLibrary.getAssetInfoAsync(asset);
        const uri = info.localUri ?? asset.uri;

        await uploadPhoto(uri, asset.filename);
        uploadedIds.add(asset.id);
        uploaded += 1;
      } catch {
        // 한 장이 실패해도 나머지는 계속한다. 성공한 것만 기록되므로
        // 실패한 사진은 다음 회차에 다시 시도된다
      }
    }

    if (uploaded > 0) await writeUploadedIds(uploadedIds);
    return uploaded;
  } catch {
    // 조회 자체가 실패하면 간격을 소진시키지 않고 다음 기회에 재시도한다
    lastSyncedAt.delete(dateKey);
    return 0;
  } finally {
    isSyncing = false;
  }
}

/** 로그아웃 시 호출 — 다음 계정이 이전 사용자의 업로드 기록을 물려받으면 안 된다 */
export async function clearPhotoSyncState(): Promise<void> {
  lastSyncedAt.clear();
  try {
    await AsyncStorage.removeItem(UPLOADED_IDS_KEY);
  } catch {
    // 지우지 못해도 다음 계정에서 사진이 한 번 더 올라갈 뿐이다
  }
}

/** 테스트 전용 — 모듈 상태 초기화 */
export function __resetPhotoSync(): void {
  lastSyncedAt.clear();
  isSyncing = false;
}
