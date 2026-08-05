import {type TimelinePlace} from '@/services/calendarApi';

// 모듈이 import 시점에 키를 읽으므로, require 전에 값을 박아야 한다.
const TEST_KEY = 'TEST_MAPS_KEY';

function loadModule(key: string | undefined) {
  let mod: typeof import('@/utils/staticMapUrl');
  jest.isolateModules(() => {
    if (key === undefined) {
      delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY;
    } else {
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY = key;
    }
    mod = require('@/utils/staticMapUrl');
  });
  return mod!;
}

const {buildStaticMapUrl, calcZoom} = loadModule(TEST_KEY);

const place = (lat: number, lng: number): TimelinePlace =>
  ({lat, lng}) as TimelinePlace;

/** 'zoom=12' → 12 */
const param = (url: string, name: string) =>
  new URL(url).searchParams.get(name);

describe('buildStaticMapUrl', () => {
  it('API 키가 없으면 null — 호출부가 폴백 UI를 띄운다', () => {
    const {buildStaticMapUrl: build} = loadModule(undefined);
    expect(build([place(37.5, 127.0)], 320, 200)).toBeNull();
  });

  it('빈 배열이면 서울 중심 고정 줌으로 폴백한다', () => {
    const url = buildStaticMapUrl([], 320, 200)!;

    expect(param(url, 'center')).toBe('37.5665,126.9780');
    expect(param(url, 'zoom')).toBe('12');
    expect(url).not.toContain('markers=');
  });

  it('장소가 하나면 그 지점을 중심으로 고정 줌 15를 쓴다', () => {
    const url = buildStaticMapUrl([place(37.5665, 126.978)], 320, 200)!;

    expect(param(url, 'center')).toBe('37.5665,126.978');
    expect(param(url, 'zoom')).toBe('15');
    expect(param(url, 'markers')).toBe('color:red|37.5665,126.978');
  });

  it('장소가 여럿이면 중심은 bounds의 한가운데다', () => {
    const url = buildStaticMapUrl(
      [place(37.0, 126.0), place(38.0, 128.0)],
      320,
      200,
    )!;

    expect(param(url, 'center')).toBe('37.5,127');
  });

  it('마커를 장소마다 하나씩, 순서대로 붙인다', () => {
    const url = buildStaticMapUrl(
      [place(37.1, 127.1), place(37.2, 127.2), place(37.3, 127.3)],
      320,
      200,
    )!;

    expect(new URL(url).searchParams.getAll('markers')).toEqual([
      'color:red|37.1,127.1',
      'color:red|37.2,127.2',
      'color:red|37.3,127.3',
    ]);
  });

  it('size·scale·key를 요청한 대로 넣는다', () => {
    const url = buildStaticMapUrl([place(37.5, 127.0)], 360, 640, 2)!;

    expect(param(url, 'size')).toBe('360x640');
    expect(param(url, 'scale')).toBe('2');
    expect(param(url, 'key')).toBe(TEST_KEY);
  });

  it('저장용(2x)과 미리보기용이 같은 중심·줌을 쓴다 — 공유 이미지가 어긋나면 안 된다', () => {
    const places = [place(37.4, 126.9), place(37.6, 127.1)];
    const preview = new URL(buildStaticMapUrl(places, 320, 200)!);
    const save = new URL(buildStaticMapUrl(places, 320, 200, 2)!);

    expect(save.searchParams.get('center')).toBe(
      preview.searchParams.get('center'),
    );
    expect(save.searchParams.get('zoom')).toBe(
      preview.searchParams.get('zoom'),
    );
  });
});

describe('calcZoom', () => {
  it('좁은 범위일수록 더 크게(높은 줌) 당긴다', () => {
    const tight = calcZoom(37.55, 37.57, 126.97, 126.99, 320, 200);
    const wide = calcZoom(37.0, 38.0, 126.0, 128.0, 320, 200);

    expect(tight).toBeGreaterThan(wide);
  });

  it('아무리 좁아도 MAX_ZOOM(16)을 넘지 않는다', () => {
    // 사실상 한 점 — latFraction이 0에 수렴해 zoom이 무한대로 튄다
    expect(calcZoom(37.5, 37.5000001, 126.9, 126.9000001, 320, 200)).toBe(15);
  });

  it('가로·세로 중 더 빡빡한 쪽에 맞춘다 — 마커가 화면 밖으로 나가면 안 된다', () => {
    // 세로로 긴 bounds를 가로로 넓은 캔버스에 담으면 세로가 제약이 된다
    const zoom = calcZoom(37.0, 38.0, 126.99, 127.0, 640, 200);
    const latOnly = calcZoom(37.0, 38.0, 126.0, 128.0, 640, 200);

    expect(zoom).toBe(latOnly);
  });

  it('전 세계 범위는 최소 줌 쪽으로 떨어진다', () => {
    expect(calcZoom(-85, 85, -180, 180, 320, 200)).toBeLessThanOrEqual(0);
  });
});
