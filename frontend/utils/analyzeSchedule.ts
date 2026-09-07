/**
 * analyze 호출 시점을 한 곳에서 관리한다.
 *
 * analyze는 그 날짜 **전체를 다시 계산**한다 — 자주 부를 이유가 없고(결과가 같다),
 * 부를 때마다 하루치 GPS가 AI 서버로 넘어가고 체류마다 장소 검색이 돈다.
 * 백그라운드는 1시간 주기, 포그라운드는 앱 진입·복귀.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {analyzeGpsLogs} from '@/services/gpsApi';
import {toLogicalDateKey} from '@/utils/formatDate';

/** 마지막으로 analyze에 성공한 논리 날짜('YYYY-MM-DD') */
const LAST_ANALYZED_DATE_KEY = 'gps:lastAnalyzedDate';

/** 백그라운드 주기 */
export const BACKGROUND_INTERVAL_MS = 60 * 60 * 1000;

/** `AppState`의 'active'는 자주 튄다 — 다이얼로그를 닫아도 발생한다 */
export const FOREGROUND_MIN_INTERVAL_MS = 60 * 1000;

/**
 * 연속 실패 시 재시도 간격의 기준. 두 번째 실패부터 이 값의 2의 거듭제곱만큼 벌린다.
 *
 * **첫 실패는 기다리지 않는다** — 일시적인 네트워크 끊김이 대부분이라
 * 곧바로 다시 시도하는 편이 낫다. 문제는 계속 실패하는 경우다.
 */
export const RETRY_BASE_MS = 60 * 1000;

/** 백그라운드/포그라운드가 함께 본다. 앱이 죽으면 사라지지만 재시작 때 한 번 돈다 */
let lastAnalyzedAt = 0;

/** 연속 실패 횟수. 성공하면 0으로 돌아간다 */
let failureCount = 0;

/** 이 시각 전에는 자동 분석을 시도하지 않는다 (사용자가 직접 누른 경우는 예외) */
let nextRetryAt = 0;

/**
 * 실패가 이어질수록 간격을 벌린다 — 서버가 죽어 있을 때 더 세게 때리면 안 된다.
 * 상한은 정상 주기와 같다. 그보다 자주 재시도할 이유가 없다.
 *
 *   1회 → 즉시 / 2회 → 1분 / 3회 → 2분 / 4회 → 4분 … 상한 60분
 */
function retryDelayMs(count: number): number {
  if (count <= 1) return 0;
  return Math.min(RETRY_BASE_MS * 2 ** (count - 2), BACKGROUND_INTERVAL_MS);
}

/** 분석이 끝날 때마다 재시도 상태를 갱신한다 */
function recordResult(succeeded: boolean, now: number): void {
  if (succeeded) {
    failureCount = 0;
    nextRetryAt = 0;
    return;
  }
  failureCount += 1;
  nextRetryAt = now + retryDelayMs(failureCount);
}

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
 * 응답의 `daily_record_id`는 쓰지 않는다 — 이 값은 늘 분석한 날짜(대개 '오늘')의
 * 것이라, 다른 날짜를 보고 있으면 화면과 어긋난다. 글쓰기 대상 id는 고른 날짜를
 * 조회하는 `useCalendar`가 정한다.
 */
async function analyzeDate(dateKey: string): Promise<boolean> {
  try {
    await analyzeGpsLogs(dateKey);
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
  if (now < nextRetryAt) return;
  if (now - lastAnalyzedAt < BACKGROUND_INTERVAL_MS) return;
  lastAnalyzedAt = now;

  const today = toLogicalDateKey(new Date(now));

  await analyzeRolledOverDate(today);

  const succeeded = await analyzeDate(today);
  recordResult(succeeded, now);

  if (succeeded) {
    await writeLastAnalyzedDate(today);
  } else {
    lastAnalyzedAt = 0; // 주기를 소진시키지 않는다 — 재시도 시점은 백오프가 정한다
  }
}

/** @returns 분석이 돌았으면 true (호출부가 화면 갱신 여부를 판단한다) */
export async function analyzeOnForeground(now = Date.now()): Promise<boolean> {
  if (now < nextRetryAt) return false;
  if (now - lastAnalyzedAt < FOREGROUND_MIN_INTERVAL_MS) return false;
  lastAnalyzedAt = now;

  const today = toLogicalDateKey(new Date(now));

  await analyzeRolledOverDate(today);

  const succeeded = await analyzeDate(today);
  recordResult(succeeded, now);

  if (succeeded) {
    await writeLastAnalyzedDate(today);
    return true;
  }

  lastAnalyzedAt = 0;
  return false;
}

/**
 * 새로고침 버튼용 — 가드를 무시하고 지금 분석한다.
 * 사용자가 직접 누른 것이라 "아직 주기가 안 됐다"로 무시하면 안 된다.
 * **백오프도 무시한다** — 기다리라고 막으면 버튼이 죽은 것처럼 보인다.
 * 다만 결과는 재시도 상태에 반영해, 성공하면 자동 경로도 함께 풀린다.
 */
export async function analyzeNow(now = Date.now()): Promise<void> {
  lastAnalyzedAt = now;

  const today = toLogicalDateKey(new Date(now));

  await analyzeRolledOverDate(today);

  try {
    await analyzeGpsLogs(today);
  } catch (error) {
    // 자동 경로와 달리 원인을 숨기지 않는다 — 호출부가 문구로 바꾼다
    lastAnalyzedAt = 0;
    recordResult(false, now);
    throw error;
  }

  recordResult(true, now);
  await writeLastAnalyzedDate(today);
}

/** 계정이 바뀌면 비운다 — 가드가 기기 단위라 새 계정의 분석이 막힌다 */
export async function resetAnalyzeSchedule(): Promise<void> {
  lastAnalyzedAt = 0;
  failureCount = 0;
  nextRetryAt = 0;
  try {
    await AsyncStorage.removeItem(LAST_ANALYZED_DATE_KEY);
  } catch {
    // 무시
  }
}

/** 테스트 전용 — 모듈 상태 초기화 */
export function __resetAnalyzeSchedule(): void {
  lastAnalyzedAt = 0;
  failureCount = 0;
  nextRetryAt = 0;
}
