import * as TaskManager from 'expo-task-manager';

import {analyzeGpsLogs, uploadGpsLogs} from '@/services/gpsApi';
import {useTimelineStore} from '@/store/timelineStore';

jest.mock('expo-task-manager', () => ({defineTask: jest.fn()}));
jest.mock('@/services/gpsApi', () => ({
  uploadGpsLogs: jest.fn(),
  analyzeGpsLogs: jest.fn(),
}));

// import 시점에 defineTask로 등록된 핸들러를 붙잡아 직접 호출한다.
require('@/tasks/gpsTask');
const handler = (TaskManager.defineTask as jest.Mock).mock.calls[0][1] as (
  body: unknown,
) => Promise<void>;

const mockUpload = uploadGpsLogs as jest.Mock;
const mockAnalyze = analyzeGpsLogs as jest.Mock;

/** expo-location이 넘겨주는 형태 — timestamp는 epoch ms */
const location = (iso: string, lat = 37.5, lng = 127.0) => ({
  coords: {latitude: lat, longitude: lng, accuracy: 5, speed: 1.2},
  timestamp: new Date(iso).getTime(),
});

const run = (locations: unknown[]) => handler({data: {locations}, error: null});

const analyzedDates = () => mockAnalyze.mock.calls.map(c => c[0]);

describe('gpsTask', () => {
  beforeEach(() => {
    mockUpload.mockReset().mockResolvedValue(undefined);
    mockAnalyze.mockReset().mockResolvedValue({daily_record_id: null});
    useTimelineStore.setState({dailyRecordId: null});
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

  it('같은 날짜 배치는 analyze를 한 번만 호출한다', async () => {
    await run([
      location('2026-08-05T04:00:00.000Z'),
      location('2026-08-05T05:00:00.000Z'),
      location('2026-08-05T06:00:00.000Z'),
    ]);

    expect(analyzedDates()).toEqual(['2026-08-05']);
  });

  // KST 자정(= 15:00Z)을 걸친 배치. 예전에는 마지막 로그의 날짜만 분석해서
  // 앞 날짜가 통째로 누락됐다.
  it('자정을 걸친 배치는 포함된 날짜를 전부, 시간순으로 분석한다', async () => {
    await run([
      location('2026-08-05T14:30:00.000Z'), // KST 8/5 23:30
      location('2026-08-05T15:30:00.000Z'), // KST 8/6 00:30
    ]);

    expect(analyzedDates()).toEqual(['2026-08-05', '2026-08-06']);
  });

  it('날짜 키는 기기 로컬이 아니라 KST 기준이다', async () => {
    await run([location('2026-08-05T15:00:00.000Z')]);

    expect(analyzedDates()).toEqual(['2026-08-06']);
  });

  it('analyze가 daily_record_id를 주면 store에 넣는다 — 글쓰기에 필요하다', async () => {
    mockAnalyze.mockResolvedValue({daily_record_id: 'rec-1'});

    await run([location('2026-08-05T04:00:00.000Z')]);

    expect(useTimelineStore.getState().dailyRecordId).toBe('rec-1');
  });

  it('daily_record_id가 없으면 기존 값을 덮어쓰지 않는다', async () => {
    useTimelineStore.setState({dailyRecordId: 'rec-old'});
    mockAnalyze.mockResolvedValue({daily_record_id: null});

    await run([location('2026-08-05T04:00:00.000Z')]);

    expect(useTimelineStore.getState().dailyRecordId).toBe('rec-old');
  });

  it('한 날짜의 analyze가 실패해도 나머지 날짜는 계속 분석한다', async () => {
    mockAnalyze
      .mockRejectedValueOnce(new Error('404'))
      .mockResolvedValueOnce({daily_record_id: 'rec-2'});

    await run([
      location('2026-08-05T14:30:00.000Z'),
      location('2026-08-05T15:30:00.000Z'),
    ]);

    expect(analyzedDates()).toEqual(['2026-08-05', '2026-08-06']);
    expect(useTimelineStore.getState().dailyRecordId).toBe('rec-2');
  });

  it('업로드가 실패하면 analyze로 넘어가지 않는다 — 다음 배치에서 재시도된다', async () => {
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
