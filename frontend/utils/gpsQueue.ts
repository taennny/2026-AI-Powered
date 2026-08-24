/**
 * GPS 좌표를 올리기 전에 기기에 쌓아두는 큐.
 *
 * 두 가지를 막는다.
 * 1. 업로드 실패 시 유실 — 예전에는 실패하면 그 배치가 그대로 사라졌다.
 *    지하철·엘리베이터·서버 재배포처럼 잠깐 끊기는 구간이 통째로 비었다.
 * 2. 계정 오귀속 — 좌표는 수집보다 몇 분 늦게 도착한다. 그 사이 계정을 바꾸면
 *    이전 계정의 좌표가 새 계정 것으로 저장됐다. 주인을 표시해두고
 *    그 계정으로 로그인했을 때만 올린다.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type {GpsLog} from '@/services/gpsApi';

const QUEUE_KEY = 'gps:queue';

/** 큐가 무한정 자라지 않게 한다. 오래된 것부터 버린다 */
const MAX_ENTRIES = 5000;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type QueueEntry = {
  ownerId: string;
  log: GpsLog;
};

async function read(): Promise<QueueEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function write(entries: QueueEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(entries));
  } catch {
    // 무시
  }
}

function prune(entries: QueueEntry[], now: number): QueueEntry[] {
  const alive = entries.filter(e => {
    const at = Date.parse(e.log.timestamp);
    return Number.isNaN(at) ? false : now - at < MAX_AGE_MS;
  });
  return alive.length > MAX_ENTRIES ? alive.slice(-MAX_ENTRIES) : alive;
}

export async function enqueueGpsLogs(
  ownerId: string,
  logs: GpsLog[],
  now = Date.now(),
): Promise<void> {
  if (logs.length === 0) return;

  const entries = await read();
  const added = logs.map(log => ({ownerId, log}));
  await write(prune([...entries, ...added], now));
}

/**
 * 지금 계정 몫만 올린다. 성공하면 큐에서 지우고, 실패하면 그대로 둬 다음에 다시 시도한다.
 * 다른 계정 몫은 건드리지 않는다 — 그 계정으로 로그인하면 그때 올라간다.
 */
export async function flushGpsLogs(
  ownerId: string,
  upload: (logs: GpsLog[]) => Promise<void>,
  now = Date.now(),
): Promise<boolean> {
  const entries = prune(await read(), now);

  const mine = entries.filter(e => e.ownerId === ownerId);
  if (mine.length === 0) {
    await write(entries);
    return false;
  }

  try {
    await upload(mine.map(e => e.log));
  } catch {
    await write(entries);
    return false;
  }

  await write(entries.filter(e => e.ownerId !== ownerId));
  return true;
}

export async function clearGpsQueue(): Promise<void> {
  try {
    await AsyncStorage.removeItem(QUEUE_KEY);
  } catch {
    // 무시
  }
}
