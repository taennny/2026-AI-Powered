import {
  formatDate,
  formatDateStr,
  formatTimeAgo,
  formatTimeFromISO,
  toDateKey,
  toKstDateKey,
} from '@/utils/formatDate';

// tz는 jest.setup.js에서 Asia/Seoul로 고정한다.

describe('toKstDateKey', () => {
  it('UTC 시각을 KST 날짜로 변환한다', () => {
    expect(toKstDateKey(new Date('2026-08-05T04:00:00.000Z'))).toBe(
      '2026-08-05',
    );
  });

  it('KST 자정을 막 넘긴 UTC 시각은 다음 날로 넘어간다', () => {
    // 15:00Z = KST 익일 00:00
    expect(toKstDateKey(new Date('2026-08-05T14:59:59.999Z'))).toBe(
      '2026-08-05',
    );
    expect(toKstDateKey(new Date('2026-08-05T15:00:00.000Z'))).toBe(
      '2026-08-06',
    );
  });

  it('월·연 경계를 넘긴다', () => {
    expect(toKstDateKey(new Date('2026-08-31T15:00:00.000Z'))).toBe(
      '2026-09-01',
    );
    expect(toKstDateKey(new Date('2026-12-31T15:00:00.000Z'))).toBe(
      '2027-01-01',
    );
  });

  it('기기 tz와 무관하게 항상 KST 기준이다', () => {
    // toDateKey는 기기 로컬 기준이라 tz가 KST인 지금은 둘이 일치한다.
    // 해외 tz로 넘어가면 이 둘이 갈라지고, 그때 서버로 보내는 키는 toKstDateKey여야 한다.
    const d = new Date('2026-08-05T04:00:00.000Z');
    expect(toKstDateKey(d)).toBe(toDateKey(d));
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
