import {
  formatDate,
  formatDateStr,
  formatTimeAgo,
  formatTimeFromISO,
  logicalToday,
  toDateKey,
  toLogicalDateKey,
} from '@/utils/formatDate';

// tz는 jest.setup.js에서 Asia/Seoul로 고정한다.
// 해외 지원을 검증하려면 그 값을 바꿔 돌려볼 것.

describe('toLogicalDateKey — 하루 경계는 새벽 4시', () => {
  /** 기기 로컬(KST) 시각으로 Date를 만든다 */
  const at = (iso: string) => new Date(`${iso}+09:00`);

  it('낮 시간은 그날 그대로다', () => {
    expect(toLogicalDateKey(at('2026-08-05T14:00:00'))).toBe('2026-08-05');
  });

  it('자정을 넘겨도 새벽 4시 전이면 아직 전날이다', () => {
    expect(toLogicalDateKey(at('2026-08-06T00:00:00'))).toBe('2026-08-05');
    expect(toLogicalDateKey(at('2026-08-06T03:59:59'))).toBe('2026-08-05');
  });

  it('새벽 4시가 되면 새 날이 시작된다', () => {
    expect(toLogicalDateKey(at('2026-08-06T04:00:00'))).toBe('2026-08-06');
  });

  it('월·연 경계도 4시 기준으로 넘어간다', () => {
    expect(toLogicalDateKey(at('2026-09-01T03:00:00'))).toBe('2026-08-31');
    expect(toLogicalDateKey(at('2027-01-01T03:00:00'))).toBe('2026-12-31');
    expect(toLogicalDateKey(at('2027-01-01T04:00:00'))).toBe('2027-01-01');
  });

  it('UTC 문자열도 기기 로컬로 해석한다', () => {
    // 19:00Z = KST 익일 04:00 → 새 날
    expect(toLogicalDateKey(new Date('2026-08-05T18:59:59Z'))).toBe(
      '2026-08-05',
    );
    expect(toLogicalDateKey(new Date('2026-08-05T19:00:00Z'))).toBe(
      '2026-08-06',
    );
  });
});

describe('toDateKey — 달력 날짜는 보정하지 않는다', () => {
  it('사용자가 고른 날짜를 그대로 쓴다', () => {
    // 캘린더가 주는 값은 그 날짜의 로컬 자정이다.
    // 여기에 4시간을 빼면 하루 전으로 밀려버린다 — 그러면 안 된다.
    const picked = new Date(2026, 7, 5);

    expect(toDateKey(picked)).toBe('2026-08-05');
    expect(toLogicalDateKey(picked)).toBe('2026-08-04');
  });
});

describe('logicalToday', () => {
  afterEach(() => jest.useRealTimers());

  it('새벽 4시 전에는 어제를 가리킨다', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-06T02:00:00+09:00'));

    expect(toDateKey(logicalToday())).toBe('2026-08-05');
  });

  it('새벽 4시 이후에는 오늘을 가리킨다', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-06T04:30:00+09:00'));

    expect(toDateKey(logicalToday())).toBe('2026-08-06');
  });

  it('그 날짜의 자정을 가리킨다 — 캘린더 표시에 그대로 쓸 수 있다', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-06T02:00:00+09:00'));

    const today = logicalToday();
    expect(today.getHours()).toBe(0);
    expect(today.getMinutes()).toBe(0);
  });
});

describe('formatDate / formatDateStr', () => {
  it("Date를 'YY.MM.DD(day)'로 만든다", () => {
    // 2026-08-05는 수요일
    expect(formatDate(new Date('2026-08-05T09:00:00+09:00'))).toBe(
      '26.08.05(wed)',
    );
  });

  it('한 자리 월·일을 0으로 채운다', () => {
    expect(formatDate(new Date('2026-01-02T09:00:00+09:00'))).toBe(
      '26.01.02(fri)',
    );
  });

  it("'YYYY-MM-DD' 문자열도 같은 결과를 낸다", () => {
    expect(formatDateStr('2026-08-05')).toBe('26.08.05(wed)');
  });

  it('날짜 문자열을 UTC가 아닌 로컬 자정으로 해석한다 — 하루 밀리면 안 된다', () => {
    expect(formatDateStr('2026-01-01')).toBe('26.01.01(thu)');
  });
});

describe('formatTimeFromISO', () => {
  it.each([
    ['2026-08-05T00:00:00+09:00', '12:00AM'],
    ['2026-08-05T09:05:00+09:00', '9:05AM'],
    ['2026-08-05T12:00:00+09:00', '12:00PM'],
    ['2026-08-05T13:30:00+09:00', '1:30PM'],
    ['2026-08-05T23:59:00+09:00', '11:59PM'],
  ])('%s → %s', (iso, expected) => {
    expect(formatTimeFromISO(iso)).toBe(expected);
  });

  it('UTC 문자열은 기기 로컬(KST)로 변환해 표시한다', () => {
    expect(formatTimeFromISO('2026-08-05T04:00:00.000Z')).toBe('1:00PM');
  });
});

describe('formatTimeAgo', () => {
  const NOW = new Date('2026-08-05T12:00:00+09:00');

  const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it.each([
    [ago(30_000), '방금'],
    [ago(MIN), '1분 전'],
    [ago(59 * MIN), '59분 전'],
    [ago(HOUR), '1시간 전'],
    [ago(23 * HOUR), '23시간 전'],
    [ago(DAY), '1일 전'],
    [ago(29 * DAY), '29일 전'],
    [ago(30 * DAY), '1달 전'],
    [ago(365 * DAY), '12달 전'],
  ])('%s → %s', (iso, expected) => {
    expect(formatTimeAgo(iso)).toBe(expected);
  });
});
