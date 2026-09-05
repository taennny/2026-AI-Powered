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

/**
 * 한 요청에 실어 보내는 최대 개수. 밀린 것을 통째로 보내면 요청이 커져
 * 타임아웃(15초)에 걸리고, 그러면 큐가 더 커져 다시 실패하는 악순환이 된다.
 */
const MAX_UPLOAD_PER_RUN = 500;

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

/**
 * 새 좌표를 큐에 넣고, 지금 계정 몫을 오래된 것부터 올린다.
 * @returns 실제로 올렸으면 true
 */
export async function queueAndUploadGpsLogs(
  ownerId: string,
  logs: GpsLog[],
  upload: (logs: GpsLog[]) => Promise<void>,
  now = Date.now(),
): Promise<boolean> {
  const stored = await read();
  const entries = prune([...stored, ...logs.map(log => ({ownerId, log}))], now);

  const mine = entries.filter(e => e.ownerId === ownerId);

  if (mine.length === 0) {
    if (entries.length !== stored.length) await write(entries);
    return false;
  }

  const batch = mine.slice(0, MAX_UPLOAD_PER_RUN);

  try {
    await upload(batch.map(e => e.log));
  } catch {
    await write(entries);
    return false;
  }

  const sent = new Set(batch);
  await write(entries.filter(e => !sent.has(e)));
  return true;
}

export async function clearGpsQueue(): Promise<void> {
  try {
    await AsyncStorage.removeItem(QUEUE_KEY);
  } catch {
    // 무시
  }
}
