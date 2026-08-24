/**
 * analyze 호출 시점을 한 곳에서 관리한다.
 *
 * analyze는 그 날짜 **전체를 다시 계산**한다 — 자주 부를 이유가 없고(결과가 같다),
 * 부를 때마다 하루치 GPS가 AI 서버로 넘어가고 체류마다 장소 검색이 돈다.
 * 백그라운드는 1시간 주기, 포그라운드는 앱 진입·복귀.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {analyzeGpsLogs} from '@/services/gpsApi';
import {useTimelineStore} from '@/store/timelineStore';
import {toLogicalDateKey} from '@/utils/formatDate';

/** 마지막으로 analyze에 성공한 논리 날짜('YYYY-MM-DD') */
const LAST_ANALYZED_DATE_KEY = 'gps:lastAnalyzedDate';

/** 백그라운드 주기 */
export const BACKGROUND_INTERVAL_MS = 60 * 60 * 1000;

/** `AppState`의 'active'는 자주 튄다 — 다이얼로그를 닫아도 발생한다 */
export const FOREGROUND_MIN_INTERVAL_MS = 60 * 1000;

/** 백그라운드/포그라운드가 함께 본다. 앱이 죽으면 사라지지만 재시작 때 한 번 돈다 */
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
    // 다음 주기에 한 번 더 분석될 뿐이다 (결과는 같다)
  }
}

/**
 * 프론트 타임아웃(15초)이 서버(30초)보다 짧아 여기서 실패해도 서버는 저장한다 —
 * 실패로 잃는 건 `daily_record_id`뿐이다.
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
 * 주기 분석은 늘 '오늘'만 봐서, 날짜가 넘어가면 전날 마지막 구간이 분석되지 않는다.
 * `lastAnalyzedDate`는 **성공했을 때만** 갱신한다 — 실패하면 다음 주기에 재시도.
 */
async function analyzeRolledOverDate(today: string): Promise<void> {
  const last = await readLastAnalyzedDate();

  // 첫 실행은 기준만 잡는다
  if (last === null) {
    await writeLastAnalyzedDate(today);
    return;
  }

  if (last === today) return;

  if (await analyzeDate(last)) {
    await writeLastAnalyzedDate(today);
  }
}

/** 백그라운드(GPS 배치)용. @param now 테스트용 주입점 */
export async function analyzePeriodically(now = Date.now()): Promise<void> {
  if (now - lastAnalyzedAt < BACKGROUND_INTERVAL_MS) return;
  lastAnalyzedAt = now;

  const today = toLogicalDateKey(new Date(now));

  await analyzeRolledOverDate(today);

  if (await analyzeDate(today)) {
    await writeLastAnalyzedDate(today);
  } else {
    lastAnalyzedAt = 0; // 주기를 소진시키지 않는다 — 다음 배치에서 재시도
  }
}

/** @returns 분석이 돌았으면 true (호출부가 화면 갱신 여부를 판단한다) */
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

/** 계정이 바뀌면 비운다 — 가드가 기기 단위라 새 계정의 분석이 막힌다 */
export async function resetAnalyzeSchedule(): Promise<void> {
  lastAnalyzedAt = 0;
  try {
    await AsyncStorage.removeItem(LAST_ANALYZED_DATE_KEY);
  } catch {
    // 무시
  }
}

/** 테스트 전용 — 모듈 상태 초기화 */
export function __resetAnalyzeSchedule(): void {
  lastAnalyzedAt = 0;
}
