import * as TaskManager from 'expo-task-manager';

import {uploadGpsLogs} from '@/services/gpsApi';
import {analyzePeriodically} from '@/utils/analyzeSchedule';

jest.mock('expo-task-manager', () => ({defineTask: jest.fn()}));
jest.mock('@/services/gpsApi', () => ({
  uploadGpsLogs: jest.fn(),
  analyzeGpsLogs: jest.fn(),
}));
jest.mock('@/utils/analyzeSchedule', () => ({
  analyzePeriodically: jest.fn(),
}));

// import 시점에 defineTask로 등록된 핸들러를 붙잡아 직접 호출한다.
require('@/tasks/gpsTask');
const handler = (TaskManager.defineTask as jest.Mock).mock.calls[0][1] as (
  body: unknown,
) => Promise<void>;

const mockUpload = uploadGpsLogs as jest.Mock;
const mockAnalyze = analyzePeriodically as jest.Mock;

/** expo-location이 넘겨주는 형태 — timestamp는 epoch ms */
const location = (iso: string, lat = 37.5, lng = 127.0) => ({
  coords: {latitude: lat, longitude: lng, accuracy: 5, speed: 1.2},
  timestamp: new Date(iso).getTime(),
});

const run = (locations: unknown[]) => handler({data: {locations}, error: null});

describe('gpsTask', () => {
  beforeEach(() => {
    mockUpload.mockReset().mockResolvedValue(undefined);
    mockAnalyze.mockReset().mockResolvedValue(undefined);
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

  it('업로드가 실패하면 분석으로 넘어가지 않는다 — 다음 배치에서 재시도된다', async () => {
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
});
