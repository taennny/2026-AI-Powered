/**
 * analyze(체류 분석) 호출 시점을 한 곳에서 관리한다.
 *
 * analyze는 "방금 온 로그만 처리"가 아니라 **그 날짜 전체를 처음부터 다시 계산**한다.
 * 그래서 자주 부를 이유가 없고(늦게 불러도 결과가 같다), 부를 때마다 하루치 GPS가
 * AI 서버로 넘어가고 체류마다 카카오 장소 검색이 돈다. 예전에는 GPS 배치마다
 * (30초 주기) 호출해서 같은 계산을 하루 2880번 반복했다.
 *
 * 호출 시점은 두 갈래다:
 *   - 백그라운드(`tasks/gpsTask.ts`) — 1시간 주기. 앱을 안 켜도 기록이 쌓이게.
 *   - 포그라운드(`hooks/useDailyAnalyze.ts`) — 앱 진입·복귀. 방금 다녀온 곳이 보이게.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {analyzeGpsLogs} from '@/services/gpsApi';
import {useTimelineStore} from '@/store/timelineStore';
import {toLogicalDateKey} from '@/utils/formatDate';

/** 마지막으로 analyze에 성공한 논리 날짜('YYYY-MM-DD') */
const LAST_ANALYZED_DATE_KEY = 'gps:lastAnalyzedDate';

/** 백그라운드 주기 */
export const BACKGROUND_INTERVAL_MS = 60 * 60 * 1000;

/**
 * 포그라운드 최소 간격. `AppState`의 'active'는 생각보다 자주 튄다 —
 * 권한 다이얼로그를 닫아도, 알림 센터를 내렸다 올려도 발생한다.
 */
export const FOREGROUND_MIN_INTERVAL_MS = 60 * 1000;

/**
 * 마지막 analyze 시각. 백그라운드/포그라운드가 함께 본다.
 *
 * 앱이 종료되면 사라지지만 그래도 된다 — 앱이 죽었다는 건 위치 태스크도 안 돌아
 * 새로 분석할 GPS 로그 자체가 없다는 뜻이고, 다시 켤 때 어차피 한 번 돈다.
 */
let lastAnalyzedAt = 0;

async function readLastAnalyzedDate(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_ANALYZED_DATE_KEY);
  } catch {
    return null;
  }
}

async function writeLastAnalyzedDate(dateKey: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_ANALYZED_DATE_KEY, dateKey);
  } catch {
    // 저장에 실패하면 다음 주기에 한 번 더 분석될 뿐이다 (결과는 같다)
  }
}

/**
 * 한 날짜를 분석한다. 성공하면 true.
 *
 * 프론트 타임아웃(15초)이 백엔드→AI 서버 타임아웃(30초)보다 짧아서, 여기서
 * 실패해도 서버는 끝까지 저장하는 경우가 있다. 그때는 다음 타임라인 조회에
 * 결과가 그대로 보인다 — 실패로 잃는 건 `daily_record_id`뿐이다.
 */
async function analyzeDate(dateKey: string): Promise<boolean> {
  try {
    const {daily_record_id} = await analyzeGpsLogs(dateKey);
    if (daily_record_id) {
      useTimelineStore.getState().setDailyRecordId(daily_record_id);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 논리 날짜가 넘어갔으면 지난 날짜를 한 번 확정 분석한다.
 *
 * 주기 분석은 늘 '오늘'만 보기 때문에, 새벽 4시를 넘겨 논리 날짜가 바뀌면
 * 전날의 마지막 구간을 아무도 분석하지 않은 채 넘어가게 된다.
 *
 * `lastAnalyzedDate`는 **성공했을 때만** 갱신한다 — 지하철에서 실패하면
 * 아직 안 한 것으로 남아 다음 주기에 다시 시도된다.
 */
async function analyzeRolledOverDate(today: string): Promise<void> {
  const last = await readLastAnalyzedDate();

  // 첫 실행: 비교 기준만 잡고 끝낸다 (그 전 기록은 이 앱이 만든 것이 아니다)
  if (last === null) {
    await writeLastAnalyzedDate(today);
    return;
  }

  if (last === today) return;

  if (await analyzeDate(last)) {
    await writeLastAnalyzedDate(today);
  }
}

/**
 * 백그라운드(GPS 배치)에서 부른다. 1시간에 한 번만 실제로 분석한다.
 *
 * @param now 테스트에서 시간을 고정하기 위한 주입점
 */
export async function analyzePeriodically(now = Date.now()): Promise<void> {
  if (now - lastAnalyzedAt < BACKGROUND_INTERVAL_MS) return;
  lastAnalyzedAt = now;

  const today = toLogicalDateKey(new Date(now));

  await analyzeRolledOverDate(today);

  if (await analyzeDate(today)) {
    await writeLastAnalyzedDate(today);
  } else {
    // 실패했으면 주기를 소진시키지 않는다 — 다음 배치(30초 뒤)에서 재시도
    lastAnalyzedAt = 0;
  }
}

/**
 * 앱 진입·포그라운드 복귀에서 부른다.
 *
 * @returns 실제로 분석이 돌았으면 true (호출부가 화면 갱신 여부를 판단한다)
 */
export async function analyzeOnForeground(now = Date.now()): Promise<boolean> {
  if (now - lastAnalyzedAt < FOREGROUND_MIN_INTERVAL_MS) return false;
  lastAnalyzedAt = now;

  const today = toLogicalDateKey(new Date(now));

  await analyzeRolledOverDate(today);

  if (await analyzeDate(today)) {
    await writeLastAnalyzedDate(today);
    return true;
  }

  lastAnalyzedAt = 0;
  return false;
}

/** 테스트 전용 — 모듈 상태 초기화 */
export function __resetAnalyzeSchedule(): void {
  lastAnalyzedAt = 0;
}
