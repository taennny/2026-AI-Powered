import AsyncStorage from '@react-native-async-storage/async-storage';

import {analyzeGpsLogs} from '@/services/gpsApi';
import {useTimelineStore} from '@/store/timelineStore';
import {
  analyzeOnForeground,
  analyzePeriodically,
  analyzeNow,
  BACKGROUND_INTERVAL_MS,
  FOREGROUND_MIN_INTERVAL_MS,
  RETRY_BASE_MS,
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

  // 서버가 죽어 있는 동안 실패할 때마다 즉시 재시도하면, 안 될수록 더 세게 때린다.
  // 실제로 analyze가 502로 계속 실패하는 동안 GPS 배치마다 하루치 로그가 올라갔다.
  describe('연속 실패 백오프', () => {
    /** 두 번 연속 실패시켜 백오프를 켠다. @returns 두 번째 실패 시각 */
    const failTwice = async (): Promise<number> => {
      mockAnalyze.mockRejectedValue(new Error('502'));
      await analyzePeriodically(T); // 1회차 실패 — 대기 없음
      await analyzePeriodically(T + 1000); // 2회차 실패 — 여기서 1분이 걸린다
      return T + 1000;
    };

    it('두 번째 실패부터는 곧바로 재시도하지 않는다', async () => {
      const failedAt = await failTwice();
      mockAnalyze.mockClear();

      await analyzePeriodically(failedAt + RETRY_BASE_MS - 1);

      expect(mockAnalyze).not.toHaveBeenCalled();
    });

    it('백오프가 지나면 다시 시도한다', async () => {
      const failedAt = await failTwice();
      mockAnalyze.mockClear();

      await analyzePeriodically(failedAt + RETRY_BASE_MS);

      expect(analyzedDates()).toEqual(['2026-08-05']);
    });

    it('실패가 이어질수록 간격이 벌어진다', async () => {
      const failedAt = await failTwice();

      // 3회차 실패 → 2분
      await analyzePeriodically(failedAt + RETRY_BASE_MS);
      mockAnalyze.mockClear();

      const thirdFailedAt = failedAt + RETRY_BASE_MS;
      await analyzePeriodically(thirdFailedAt + RETRY_BASE_MS); // 1분 뒤 — 아직 이르다
      expect(mockAnalyze).not.toHaveBeenCalled();

      await analyzePeriodically(thirdFailedAt + 2 * RETRY_BASE_MS);
      expect(mockAnalyze).toHaveBeenCalled();
    });

    it('성공하면 간격이 초기화된다', async () => {
      const failedAt = await failTwice();

      mockAnalyze.mockClear().mockResolvedValue({daily_record_id: 'rec-1'});
      await analyzePeriodically(failedAt + RETRY_BASE_MS); // 성공

      // 다시 한 번 실패해도 첫 실패 취급이라 곧바로 재시도된다
      const okAt = failedAt + RETRY_BASE_MS;
      mockAnalyze.mockClear().mockRejectedValue(new Error('502'));
      await analyzePeriodically(okAt + BACKGROUND_INTERVAL_MS);

      mockAnalyze.mockClear().mockResolvedValue({daily_record_id: 'rec-2'});
      await analyzePeriodically(okAt + BACKGROUND_INTERVAL_MS + 1000);

      expect(mockAnalyze).toHaveBeenCalled();
    });

    it('포그라운드 복귀도 백오프를 지킨다', async () => {
      const failedAt = await failTwice();
      mockAnalyze.mockClear();

      await expect(
        analyzeOnForeground(failedAt + RETRY_BASE_MS - 1),
      ).resolves.toBe(false);
      expect(mockAnalyze).not.toHaveBeenCalled();
    });

    // 사용자가 직접 누른 것이라 "아직 기다려야 한다"로 막으면 버튼이 죽은 것처럼 보인다
    it('새로고침 버튼은 백오프를 무시한다', async () => {
      const failedAt = await failTwice();
      mockAnalyze.mockClear().mockResolvedValue({daily_record_id: 'rec-1'});

      await analyzeNow(failedAt + 1000);

      expect(analyzedDates()).toEqual(['2026-08-05']);
    });

    it('새로고침 버튼이 성공하면 자동 경로의 백오프도 풀린다', async () => {
      const failedAt = await failTwice();
      mockAnalyze.mockClear().mockResolvedValue({daily_record_id: 'rec-1'});
      await analyzeNow(failedAt + 1000);

      mockAnalyze.mockClear();
      await analyzePeriodically(failedAt + 1000 + BACKGROUND_INTERVAL_MS);

      expect(mockAnalyze).toHaveBeenCalled();
    });
  });
});
