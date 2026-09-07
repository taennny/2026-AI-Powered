import {groupPlaces} from '@/components/bottomsheet/BottomSheet';
import {type TimelinePlace} from '@/services/calendarApi';

/** 필요한 필드만 채운 장소 */
const place = (
  arrived_at: string,
  extra: Partial<TimelinePlace> = {},
): TimelinePlace => ({
  place_id: arrived_at,
  name: '장소',
  category: '카페',
  arrived_at,
  left_at: arrived_at,
  lat: 0,
  lng: 0,
  ...extra,
});

const KST = 9 * 60;
const PDT = -7 * 60;

describe('groupPlaces', () => {
  it('같은 시(hour)끼리 묶는다', () => {
    const groups = groupPlaces([
      place('2026-09-06T01:00:00.000Z', {utc_offset_minutes: KST}), // 10시
      place('2026-09-06T01:30:00.000Z', {utc_offset_minutes: KST}), // 10시
      place('2026-09-06T02:00:00.000Z', {utc_offset_minutes: KST}), // 11시
    ]);

    expect(groups.map(g => g.hour)).toEqual([10, 11]);
    expect(groups[0].places).toHaveLength(2);
  });

  // 예전에는 '몇 시' 숫자로 정렬해서 자정 넘긴 기록이 맨 위로 올라갔다.
  // 서버 순서를 그대로 쓰면 그런 일이 없다.
  it('서버가 준 순서를 바꾸지 않는다 — 자정을 넘겨도', () => {
    const groups = groupPlaces([
      place('2026-09-06T11:00:00.000Z', {utc_offset_minutes: KST}), // 20시
      place('2026-09-06T16:00:00.000Z', {utc_offset_minutes: KST}), // 다음날 1시
    ]);

    expect(groups.map(g => g.hour)).toEqual([20, 1]);
  });

  // 이 기능의 핵심 — 서울 10시와 LA 10시는 16시간 떨어진 다른 시각이다
  it('시가 같아도 시간대가 다르면 다른 묶음이다', () => {
    const groups = groupPlaces([
      place('2026-09-06T01:00:00.000Z', {
        timezone: 'Asia/Seoul',
        utc_offset_minutes: KST,
      }),
      place('2026-09-06T17:00:00.000Z', {
        timezone: 'America/Los_Angeles',
        utc_offset_minutes: PDT,
      }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map(g => g.hour)).toEqual([10, 10]);
    expect(groups.map(g => g.timezone)).toEqual([
      'Asia/Seoul',
      'America/Los_Angeles',
    ]);
  });

  it('오프셋이 없으면 기기 시간대로 읽는다 — 구버전 서버', () => {
    // jest.setup.js가 tz를 Asia/Seoul로 고정한다
    const groups = groupPlaces([place('2026-09-06T01:00:00.000Z')]);

    expect(groups[0].hour).toBe(10);
    expect(groups[0].timezone).toBeNull();
  });

  it('빈 목록은 빈 묶음', () => {
    expect(groupPlaces([])).toEqual([]);
  });

  it('떨어져 있던 같은 시가 다시 나오면 새 묶음이다', () => {
    const groups = groupPlaces([
      place('2026-09-06T01:00:00.000Z', {utc_offset_minutes: KST}), // 10시
      place('2026-09-06T02:00:00.000Z', {utc_offset_minutes: KST}), // 11시
      place('2026-09-07T01:00:00.000Z', {utc_offset_minutes: KST}), // 10시
    ]);

    expect(groups.map(g => g.hour)).toEqual([10, 11, 10]);
  });
});
