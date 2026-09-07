import * as TaskManager from 'expo-task-manager';

import {uploadGpsLogs} from '@/services/gpsApi';
import {analyzePeriodically} from '@/utils/analyzeSchedule';
import {getCurrentUserId} from '@/utils/currentUser';
import {clearGpsQueue} from '@/utils/gpsQueue';

jest.mock('expo-task-manager', () => ({defineTask: jest.fn()}));
jest.mock('@/services/gpsApi', () => ({
  uploadGpsLogs: jest.fn(),
  analyzeGpsLogs: jest.fn(),
}));
jest.mock('@/utils/analyzeSchedule', () => ({
  analyzePeriodically: jest.fn(),
}));
jest.mock('@/utils/currentUser', () => ({getCurrentUserId: jest.fn()}));

// import 시점에 defineTask로 등록된 핸들러를 붙잡아 직접 호출한다.
require('@/tasks/gpsTask');
const handler = (TaskManager.defineTask as jest.Mock).mock.calls[0][1] as (
  body: unknown,
) => Promise<void>;

const mockUpload = uploadGpsLogs as jest.Mock;
const mockAnalyze = analyzePeriodically as jest.Mock;
const mockOwner = getCurrentUserId as jest.Mock;

/** expo-location이 넘겨주는 형태 — timestamp는 epoch ms */
const location = (iso: string, lat = 37.5, lng = 127.0) => ({
  coords: {latitude: lat, longitude: lng, accuracy: 5, speed: 1.2},
  timestamp: new Date(iso).getTime(),
});

const run = (locations: unknown[]) => handler({data: {locations}, error: null});

describe('gpsTask', () => {
  // 큐가 오래된 좌표를 버리므로 좌표 시각과 '지금'을 같은 날에 둔다
  beforeAll(() => {
    jest.useFakeTimers({now: new Date('2026-08-05T04:30:00.000Z')});
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    mockUpload.mockReset().mockResolvedValue(undefined);
    mockAnalyze.mockReset().mockResolvedValue(undefined);
    mockOwner.mockReset().mockResolvedValue('user-a');
    await clearGpsQueue();
  });

  it('좌표를 서버 형식으로 바꿔 올린다 — timestamp는 ISO 8601 UTC 문자열', async () => {
    await run([location('2026-08-05T04:00:00.000Z', 37.5665, 126.978)]);

    expect(mockUpload).toHaveBeenCalledWith([
      {
        lat: 37.5665,
        lng: 126.978,
        accuracy: 5,
        speed: 1.2,
        timestamp: '2026-08-05T04:00:00.000Z',
      },
    ]);
  });

  it('accuracy·speed가 null이면 0으로 채운다', async () => {
    await run([
      {
        coords: {latitude: 37.5, longitude: 127.0, accuracy: null, speed: null},
        timestamp: new Date('2026-08-05T04:00:00.000Z').getTime(),
      },
    ]);

    expect(mockUpload.mock.calls[0][0][0]).toMatchObject({
      accuracy: 0,
      speed: 0,
    });
  });

  // 예전에는 배치마다 analyze를 불러서 같은 계산을 하루 2880번 반복했다.
  // 이제 태스크는 스케줄러에 넘기기만 하고, 실제 호출 여부는 스케줄러가 정한다.
  it('배치마다 업로드하고, 분석 여부는 스케줄러에 위임한다', async () => {
    await run([
      location('2026-08-05T04:00:00.000Z'),
      location('2026-08-05T05:00:00.000Z'),
    ]);

    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockAnalyze).toHaveBeenCalledTimes(1);
  });

  it('업로드가 실패하면 분석으로 넘어가지 않는다', async () => {
    mockUpload.mockRejectedValue(new Error('network'));

    await expect(
      run([location('2026-08-05T04:00:00.000Z')]),
    ).resolves.toBeUndefined();
    expect(mockAnalyze).not.toHaveBeenCalled();
  });

  it('error가 오면 아무것도 하지 않는다', async () => {
    await handler({data: null, error: new Error('location error')});

    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockAnalyze).not.toHaveBeenCalled();
  });

  // 예전에는 실패한 배치가 그대로 사라졌다 — 끊긴 구간이 통째로 비었다
  it('실패한 좌표는 큐에 남아 다음 배치에서 함께 올라간다', async () => {
    mockUpload.mockRejectedValueOnce(new Error('network'));
    await run([location('2026-08-05T04:00:00.000Z')]);

    await run([location('2026-08-05T04:00:30.000Z')]);

    expect(mockUpload).toHaveBeenLastCalledWith([
      expect.objectContaining({timestamp: '2026-08-05T04:00:00.000Z'}),
      expect.objectContaining({timestamp: '2026-08-05T04:00:30.000Z'}),
    ]);
  });

  // 밀린 것을 통째로 보내면 요청이 커져 타임아웃에 걸리고, 그러면 큐가 더 커져
  // 다시 실패한다. 한 번에 보내는 개수를 제한해 그 악순환을 막는다
  it('한 번에 보내는 개수를 제한하고, 남은 것은 다음 배치에서 올린다', async () => {
    mockUpload.mockRejectedValueOnce(new Error('network'));
    const many = Array.from({length: 600}, (_, i) =>
      location(
        new Date(
          Date.parse('2026-08-05T04:00:00.000Z') + i * 1000,
        ).toISOString(),
      ),
    );
    await run(many);

    mockUpload.mockClear();
    await run([location('2026-08-05T04:20:00.000Z')]);

    expect(mockUpload.mock.calls[0][0]).toHaveLength(500);

    mockUpload.mockClear();
    await run([location('2026-08-05T04:21:00.000Z')]);

    // 남은 100개 + 그사이 들어온 2개
    expect(mockUpload.mock.calls[0][0]).toHaveLength(102);
  });

  // 읽기-수정-쓰기라 겹쳐 돌면 한쪽 결과가 덮인다. 건너뛰면 그 배치를 잃으므로
  // 순서를 세워 둘 다 처리해야 한다
  it('동시에 들어와도 좌표를 잃지 않는다', async () => {
    mockUpload.mockRejectedValue(new Error('network'));

    await Promise.all([
      run([location('2026-08-05T04:00:00.000Z')]),
      run([location('2026-08-05T04:00:30.000Z')]),
    ]);

    mockUpload.mockReset().mockResolvedValue(undefined);
    await run([location('2026-08-05T04:01:00.000Z')]);

    expect(mockUpload.mock.calls[0][0]).toHaveLength(3);
  });

  it('주인을 모르면 올리지 않는다', async () => {
    mockOwner.mockResolvedValue(null);

    await run([location('2026-08-05T04:00:00.000Z')]);

    expect(mockUpload).not.toHaveBeenCalled();
  });

  // 좌표는 수집보다 몇 분 늦게 도착한다 — 그 사이 계정을 바꾸면 남의 기록이 된다
  it('다른 계정으로 쌓인 좌표는 올리지 않고, 그 계정으로 돌아오면 올린다', async () => {
    mockUpload.mockRejectedValueOnce(new Error('network'));
    await run([location('2026-08-05T04:00:00.000Z')]);

    mockOwner.mockResolvedValue('user-b');
    await run([location('2026-08-05T04:10:00.000Z')]);

    expect(mockUpload).toHaveBeenLastCalledWith([
      expect.objectContaining({timestamp: '2026-08-05T04:10:00.000Z'}),
    ]);

    mockOwner.mockResolvedValue('user-a');
    await run([location('2026-08-05T04:20:00.000Z')]);

    expect(mockUpload).toHaveBeenLastCalledWith([
      expect.objectContaining({timestamp: '2026-08-05T04:00:00.000Z'}),
      expect.objectContaining({timestamp: '2026-08-05T04:20:00.000Z'}),
    ]);
  });
});
