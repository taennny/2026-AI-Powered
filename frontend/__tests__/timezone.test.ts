import * as Localization from 'expo-localization';

import {getDeviceTimeZone} from '@/utils/timezone';

jest.mock('expo-localization', () => ({getCalendars: jest.fn()}));

const mockGetCalendars = Localization.getCalendars as jest.Mock;

/** Intl.DateTimeFormat().resolvedOptions().timeZone을 갈아끼운다 */
function mockIntlTimeZone(timeZone: string | undefined) {
  jest.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
    resolvedOptions: () => ({timeZone}),
  } as unknown as Intl.DateTimeFormat);
}

describe('getDeviceTimeZone', () => {
  afterEach(() => jest.restoreAllMocks());

  it('expo-localization이 준 값을 우선한다', () => {
    mockGetCalendars.mockReturnValue([{timeZone: 'America/New_York'}]);
    mockIntlTimeZone('Asia/Seoul');

    expect(getDeviceTimeZone()).toBe('America/New_York');
  });

  // Hermes가 timeZone을 UTC로 뱉는 사례 — 이걸 그대로 믿으면
  // 한국 사용자의 하루 경계가 9시간 밀린다
  it('expo-localization이 UTC를 주면 Intl로 넘어간다', () => {
    mockGetCalendars.mockReturnValue([{timeZone: 'UTC'}]);
    mockIntlTimeZone('Asia/Seoul');

    expect(getDeviceTimeZone()).toBe('Asia/Seoul');
  });

  it('expo-localization이 비어 있어도 Intl로 넘어간다', () => {
    mockGetCalendars.mockReturnValue([]);
    mockIntlTimeZone('Europe/Paris');

    expect(getDeviceTimeZone()).toBe('Europe/Paris');
  });

  it('둘 다 UTC면 진짜 UTC 기기일 수 있으니 UTC를 쓴다', () => {
    mockGetCalendars.mockReturnValue([{timeZone: 'UTC'}]);
    mockIntlTimeZone('UTC');

    expect(getDeviceTimeZone()).toBe('UTC');
  });

  it('Intl이 없는 환경이면 Asia/Seoul로 떨어진다', () => {
    mockGetCalendars.mockReturnValue([{timeZone: null}]);
    jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('Intl 미지원');
    });

    expect(getDeviceTimeZone()).toBe('Asia/Seoul');
  });

  it('IANA 문자열을 반환한다 — 오프셋 숫자가 아니다', () => {
    mockGetCalendars.mockReturnValue([{timeZone: 'Asia/Seoul'}]);

    // 서머타임 지역에서 계절마다 값이 달라지면 과거 기록을 다시 계산할 수 없다
    expect(getDeviceTimeZone()).toMatch(/^[A-Za-z]+\/[A-Za-z_]+$|^UTC$/);
  });
});
