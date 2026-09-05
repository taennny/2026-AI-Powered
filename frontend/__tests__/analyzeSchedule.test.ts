import AsyncStorage from '@react-native-async-storage/async-storage';

import {analyzeGpsLogs} from '@/services/gpsApi';
import {useTimelineStore} from '@/store/timelineStore';
import {
  analyzeOnForeground,
  analyzePeriodically,
  BACKGROUND_INTERVAL_MS,
  FOREGROUND_MIN_INTERVAL_MS,
  __resetAnalyzeSchedule,
} from '@/utils/analyzeSchedule';

jest.mock('@/services/gpsApi', () => ({analyzeGpsLogs: jest.fn()}));

const mockAnalyze = analyzeGpsLogs as jest.Mock;
const analyzedDates = () => mockAnalyze.mock.calls.map(c => c[0]);
const lastDate = () => AsyncStorage.getItem('gps:lastAnalyzedDate');

/** 로컬(Asia/Seoul) 8/5 13:00 — 논리 날짜 2026-08-05 */
const T = new Date('2026-08-05T04:00:00.000Z').getTime();
/** 로컬 8/6 13:00 — 논리 날짜 2026-08-06 */
const NEXT_DAY = new Date('2026-08-06T04:00:00.000Z').getTime();

describe('analyzeSchedule', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    __resetAnalyzeSchedule();
    mockAnalyze.mockReset().mockResolvedValue({daily_record_id: null});
    useTimelineStore.setState({dailyRecordId: null});
  });

  describe('analyzePeriodically (백그라운드)', () => {
    it('첫 호출은 오늘을 분석하고 기준 날짜를 저장한다', async () => {
      await analyzePeriodically(T);

      expect(analyzedDates()).toEqual(['2026-08-05']);
      expect(await lastDate()).toBe('2026-08-05');
    });

    // 예전에는 GPS 배치(30초)마다 불러서 같은 하루를 2880번 재계산했다
    it('1시간 안에 다시 부르면 아무것도 하지 않는다', async () => {
      await analyzePeriodically(T);
      mockAnalyze.mockClear();

      await analyzePeriodically(T + 30_000);
      await analyzePeriodically(T + 59 * 60 * 1000);

      expect(mockAnalyze).not.toHaveBeenCalled();
    });

    it('1시간이 지나면 다시 분석한다', async () => {
      await analyzePeriodically(T);
      mockAnalyze.mockClear();

      await analyzePeriodically(T + BACKGROUND_INTERVAL_MS);

      expect(analyzedDates()).toEqual(['2026-08-05']);
    });

    // 주기 분석은 늘 '오늘'만 본다. 논리 날짜가 넘어가면 전날의 마지막 구간을
    // 아무도 분석하지 않은 채 넘어가므로, 넘어간 것을 감지해 한 번 확정한다.
    it('논리 날짜가 넘어가면 전날을 확정 분석한 뒤 오늘을 분석한다', async () => {
      await analyzePeriodically(T);
      mockAnalyze.mockClear();

      await analyzePeriodically(NEXT_DAY);

      expect(analyzedDates()).toEqual(['2026-08-05', '2026-08-06']);
      expect(await lastDate()).toBe('2026-08-06');
    });

    it('전날 확정이 실패하면 기준 날짜를 갱신하지 않는다 — 다음 주기에 재시도', async () => {
      await analyzePeriodically(T);
      mockAnalyze.mockClear();
      mockAnalyze
        .mockRejectedValueOnce(new Error('network')) // 전날 확정 실패
        .mockResolvedValueOnce({daily_record_id: 'rec-1'}); // 오늘은 성공

      await analyzePeriodically(NEXT_DAY);

      // 오늘 분석이 성공해 날짜는 갱신되지만, 실패한 전날은 다음 기회를 얻는다
      expect(analyzedDates()).toEqual(['2026-08-05', '2026-08-06']);
    });

    it('오늘 분석이 실패하면 주기를 소진하지 않는다 — 다음 배치에서 재시도', async () => {
      mockAnalyze.mockRejectedValue(new Error('timeout'));

      await analyzePeriodically(T);
      mockAnalyze.mockClear().mockResolvedValue({daily_record_id: 'rec-1'});

      await analyzePeriodically(T + 30_000);

      expect(analyzedDates()).toEqual(['2026-08-05']);
    });

    // 응답의 id는 늘 분석한 날짜('오늘') 것이라, 어제를 보고 있으면 화면과 어긋난다.
    // 글쓰기 대상은 고른 날짜를 조회하는 useCalendar가 정한다.
    it('daily_record_id를 store에 넣지 않는다', async () => {
      useTimelineStore.setState({dailyRecordId: 'rec-old'});
      mockAnalyze.mockResolvedValue({daily_record_id: 'rec-today'});

      await analyzePeriodically(T);

      expect(useTimelineStore.getState().dailyRecordId).toBe('rec-old');
    });
  });

  describe('analyzeOnForeground (앱 진입·복귀)', () => {
    it('분석이 돌면 true를 준다 — 호출부가 화면 갱신을 판단한다', async () => {
      await expect(analyzeOnForeground(T)).resolves.toBe(true);
      expect(analyzedDates()).toEqual(['2026-08-05']);
    });

    // AppState 'active'는 권한 다이얼로그를 닫아도, 알림 센터를 내렸다 올려도 튄다
    it('1분 안에 다시 부르면 건너뛰고 false를 준다', async () => {
      await analyzeOnForeground(T);
      mockAnalyze.mockClear();

      await expect(analyzeOnForeground(T + 10_000)).resolves.toBe(false);
      expect(mockAnalyze).not.toHaveBeenCalled();
    });

    it('1분이 지나면 다시 분석한다', async () => {
      await analyzeOnForeground(T);
      mockAnalyze.mockClear();

      await expect(
        analyzeOnForeground(T + FOREGROUND_MIN_INTERVAL_MS),
      ).resolves.toBe(true);
    });

    it('실패하면 false를 주고 가드를 풀어 다음 복귀에 재시도한다', async () => {
      mockAnalyze.mockRejectedValue(new Error('502'));

      await expect(analyzeOnForeground(T)).resolves.toBe(false);

      mockAnalyze.mockClear().mockResolvedValue({daily_record_id: null});
      await expect(analyzeOnForeground(T + 1000)).resolves.toBe(true);
    });

    // 백그라운드와 포그라운드가 같은 시각을 공유해 겹쳐 돌지 않는다
    it('백그라운드가 방금 분석했으면 포그라운드는 건너뛴다', async () => {
      await analyzePeriodically(T);
      mockAnalyze.mockClear();

      await expect(analyzeOnForeground(T + 5_000)).resolves.toBe(false);
      expect(mockAnalyze).not.toHaveBeenCalled();
    });
  });
});
