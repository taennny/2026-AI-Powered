import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import * as Network from 'expo-network';

import {uploadPhoto} from '@/services/photoApi';
import {
  syncPhotosForDate,
  clearPhotoSyncState,
  SYNC_MIN_INTERVAL_MS,
  __resetPhotoSync,
} from '@/utils/photoSync';

jest.mock('expo-media-library', () => ({
  getPermissionsAsync: jest.fn(),
  getAssetsAsync: jest.fn(),
  getAssetInfoAsync: jest.fn(),
}));
jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(),
  NetworkStateType: {WIFI: 'WIFI', CELLULAR: 'CELLULAR', NONE: 'NONE'},
}));
jest.mock('@/services/photoApi', () => ({uploadPhoto: jest.fn()}));

const mockPerm = MediaLibrary.getPermissionsAsync as jest.Mock;
const mockAssets = MediaLibrary.getAssetsAsync as jest.Mock;
const mockInfo = MediaLibrary.getAssetInfoAsync as jest.Mock;
const mockUpload = uploadPhoto as jest.Mock;
const mockNet = Network.getNetworkStateAsync as jest.Mock;

const asset = (
  id: string,
  overrides: Partial<MediaLibrary.Asset> = {},
): MediaLibrary.Asset =>
  ({
    id,
    filename: `${id}.jpg`,
    uri: `ph://${id}`,
    mediaSubtypes: [],
    ...overrides,
  }) as MediaLibrary.Asset;

/** 로컬(Asia/Seoul) 8/6 13:00 */
const NOW = new Date('2026-08-06T04:00:00.000Z').getTime();
const TODAY = '2026-08-06';

const uploadedIds = () => mockUpload.mock.calls.map(c => c[1]);

describe('photoSync', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    __resetPhotoSync();
    mockPerm.mockReset().mockResolvedValue({status: 'granted'});
    mockAssets.mockReset().mockResolvedValue({assets: []});
    mockInfo.mockReset().mockImplementation(async (a: MediaLibrary.Asset) => ({
      ...a,
      localUri: `file:///${a.id}.jpg`,
      exif: {DateTimeOriginal: '2026:08:06 13:00:00'},
    }));
    mockUpload.mockReset().mockResolvedValue({photo_id: 'p'});
    mockNet.mockReset().mockResolvedValue({type: 'WIFI'});
  });

  it('권한이 없으면 사진을 조회하지도 않는다', async () => {
    mockPerm.mockResolvedValue({status: 'denied'});

    await expect(syncPhotosForDate(TODAY, NOW)).resolves.toBe(0);
    expect(mockAssets).not.toHaveBeenCalled();
  });

  // 하루 경계는 자정이 아니라 기기 로컬 새벽 4시다 (utils/formatDate)
  it('논리적 하루(새벽 4시~4시) 범위로 조회한다', async () => {
    await syncPhotosForDate(TODAY, NOW);

    const {createdAfter, createdBefore} = mockAssets.mock.calls[0][0];
    expect(createdAfter.getHours()).toBe(4);
    expect(createdAfter.getDate()).toBe(6);
    expect(createdBefore.getDate()).toBe(7);
    expect(createdBefore.getHours()).toBe(4);
  });

  // 서버는 taken_at을 EXIF로만 정한다. 없으면 업로드 시각으로 저장돼
  // "지금 있는 장소"에 붙는다 — 스크린샷·저장한 이미지·받은 사진이 전부 그렇다
  describe('촬영 시각이 없는 사진', () => {
    const withoutExif = (a: MediaLibrary.Asset) => ({
      ...a,
      localUri: `file:///${a.id}.jpg`,
    });

    it('올리지 않는다', async () => {
      mockAssets.mockResolvedValue({assets: [asset('a'), asset('saved')]});
      mockInfo.mockImplementation(async (a: MediaLibrary.Asset) =>
        a.id === 'saved'
          ? withoutExif(a)
          : {...withoutExif(a), exif: {DateTimeOriginal: '2026:08:06 13:00:00'}},
      );

      await expect(syncPhotosForDate(TODAY, NOW)).resolves.toBe(1);
      expect(uploadedIds()).toEqual(['a.jpg']);
    });

    it('중첩된 EXIF 구조도 읽는다 (플랫폼마다 다르다)', async () => {
      mockAssets.mockResolvedValue({assets: [asset('a')]});
      mockInfo.mockImplementation(async (a: MediaLibrary.Asset) => ({
        ...withoutExif(a),
        exif: {Exif: {DateTimeOriginal: '2026:08:06 13:00:00'}},
      }));

      await expect(syncPhotosForDate(TODAY, NOW)).resolves.toBe(1);
    });

    // iOS는 CGImage 속성 딕셔너리를 그대로 넘겨 키가 '{Exif}'다.
    // 이걸 못 읽으면 아이폰 사진이 한 장도 안 올라간다
    it("iOS의 '{Exif}' 키도 읽는다", async () => {
      mockAssets.mockResolvedValue({assets: [asset('a')]});
      mockInfo.mockImplementation(async (a: MediaLibrary.Asset) => ({
        ...withoutExif(a),
        exif: {
          PixelWidth: 4032,
          '{Exif}': {DateTimeOriginal: '2026:08:06 13:00:00'},
        },
      }));

      await expect(syncPhotosForDate(TODAY, NOW)).resolves.toBe(1);
    });

    // 기록해두지 않으면 회차마다 같은 사진의 EXIF를 다시 읽는다
    it('건너뛴 사진도 기록해 다시 검사하지 않는다', async () => {
      mockAssets.mockResolvedValue({assets: [asset('saved')]});
      mockInfo.mockImplementation(async (a: MediaLibrary.Asset) =>
        withoutExif(a),
      );
      await syncPhotosForDate(TODAY, NOW);

      mockInfo.mockClear();
      await syncPhotosForDate(TODAY, NOW + SYNC_MIN_INTERVAL_MS);

      expect(mockInfo).not.toHaveBeenCalled();
    });
  });

  // usePhotoSync(오늘)와 useCalendar(고른 날짜)가 거의 동시에 들어온다.
  // 잠그기 전에 await이 있으면 둘 다 통과해 같은 사진을 두 번 올린다
  it('동시에 불려도 한 번만 올린다', async () => {
    mockAssets.mockResolvedValue({assets: [asset('a')]});

    const [first, second] = await Promise.all([
      syncPhotosForDate(TODAY, NOW),
      syncPhotosForDate(TODAY, NOW),
    ]);

    expect(first + second).toBe(1);
    expect(mockUpload).toHaveBeenCalledTimes(1);
  });

  it('iOS의 ph:// 대신 실제 파일 경로로 올린다', async () => {
    mockAssets.mockResolvedValue({assets: [asset('a')]});

    await syncPhotosForDate(TODAY, NOW);

    expect(mockUpload).toHaveBeenCalledWith('file:///a.jpg', 'a.jpg');
  });

  it('이미 올린 사진은 다시 올리지 않는다', async () => {
    mockAssets.mockResolvedValue({assets: [asset('a')]});
    await syncPhotosForDate(TODAY, NOW);
    mockUpload.mockClear();

    mockAssets.mockResolvedValue({assets: [asset('a'), asset('b')]});
    await expect(syncPhotosForDate(TODAY, NOW + SYNC_MIN_INTERVAL_MS)).resolves.toBe(1);
    expect(uploadedIds()).toEqual(['b.jpg']);
  });

  it('한 장이 실패해도 나머지는 계속 올리고, 실패한 것은 다음에 재시도한다', async () => {
    mockAssets.mockResolvedValue({assets: [asset('a'), asset('b')]});
    mockUpload
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({photo_id: 'p'});

    await expect(syncPhotosForDate(TODAY, NOW)).resolves.toBe(1);

    mockUpload.mockClear().mockResolvedValue({photo_id: 'p'});
    await syncPhotosForDate(TODAY, NOW + SYNC_MIN_INTERVAL_MS);

    expect(uploadedIds()).toEqual(['a.jpg']);
  });

  it('최소 간격 안에는 다시 돌지 않는다', async () => {
    mockAssets.mockResolvedValue({assets: [asset('a')]});
    await syncPhotosForDate(TODAY, NOW);
    mockAssets.mockClear();

    await expect(syncPhotosForDate(TODAY, NOW + 1000)).resolves.toBe(0);
    expect(mockAssets).not.toHaveBeenCalled();
  });

  it('로그아웃하면 업로드 기록을 지운다 — 다음 계정이 물려받으면 안 된다', async () => {
    mockAssets.mockResolvedValue({assets: [asset('a')]});
    await syncPhotosForDate(TODAY, NOW);

    await clearPhotoSyncState();

    mockUpload.mockClear();
    await syncPhotosForDate(TODAY, NOW + SYNC_MIN_INTERVAL_MS);
    expect(uploadedIds()).toEqual(['a.jpg']);
  });

  // 사진 한 장이 3~5MB다. 하루치만 해도 수백 MB가 나갈 수 있다
  describe('와이파이', () => {
    it('셀룰러면 올리지 않는다', async () => {
      mockNet.mockResolvedValue({type: 'CELLULAR'});
      mockAssets.mockResolvedValue({assets: [asset('a')]});

      await expect(syncPhotosForDate(TODAY, NOW)).resolves.toBe(0);
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('연결 상태를 확인하지 못하면 올리지 않는다', async () => {
      mockNet.mockRejectedValue(new Error('unavailable'));
      mockAssets.mockResolvedValue({assets: [asset('a')]});

      await expect(syncPhotosForDate(TODAY, NOW)).resolves.toBe(0);
      expect(mockUpload).not.toHaveBeenCalled();
    });

    // 권한을 나중에 켜고 돌아왔을 때 5분을 기다리게 하면 안 된다
    it('권한이 없어 건너뛴 날짜는 권한을 켜면 바로 올린다', async () => {
      mockPerm.mockResolvedValue({status: 'denied'});
      mockAssets.mockResolvedValue({assets: [asset('a')]});
      await syncPhotosForDate(TODAY, NOW);

      mockPerm.mockResolvedValue({status: 'granted'});
      await expect(syncPhotosForDate(TODAY, NOW + 1000)).resolves.toBe(1);
    });

    it('셀룰러라 건너뛴 날짜는 와이파이가 되면 바로 올린다', async () => {
      mockNet.mockResolvedValue({type: 'CELLULAR'});
      mockAssets.mockResolvedValue({assets: [asset('a')]});
      await syncPhotosForDate(TODAY, NOW);

      // 간격 가드를 소진하지 않았어야 한다
      mockNet.mockResolvedValue({type: 'WIFI'});
      await expect(syncPhotosForDate(TODAY, NOW + 1000)).resolves.toBe(1);
    });
  });

  describe('날짜별 처리', () => {
    // 오늘을 올린 직후 캘린더에서 과거 날짜를 열어도 막히면 안 된다
    it('간격 가드는 날짜마다 따로 센다', async () => {
      mockAssets.mockResolvedValue({assets: [asset('a')]});
      await syncPhotosForDate(TODAY, NOW);
      mockAssets.mockClear().mockResolvedValue({assets: [asset('b')]});

      await expect(syncPhotosForDate('2026-07-01', NOW + 1000)).resolves.toBe(1);
    });

    it('고른 날짜의 범위로 조회한다', async () => {
      await syncPhotosForDate('2026-07-01', NOW);

      const {createdAfter, createdBefore} = mockAssets.mock.calls[0][0];
      expect(createdAfter.getMonth()).toBe(6); // 7월
      expect(createdAfter.getDate()).toBe(1);
      expect(createdBefore.getDate()).toBe(2);
    });

    it('날짜 형식이 아니면 아무것도 하지 않는다', async () => {
      await expect(syncPhotosForDate('', NOW)).resolves.toBe(0);
      expect(mockAssets).not.toHaveBeenCalled();
    });
  });

  // 200장 상한에 걸리면 늦게 찍은 것이 잘린다 — 카드에는 도착 직후 사진이 어울린다
  it('오래된 사진부터 훑는다', async () => {
    await syncPhotosForDate(TODAY, NOW);

    expect(mockAssets.mock.calls[0][0].sortBy).toEqual([['creationTime', true]]);
  });
});
