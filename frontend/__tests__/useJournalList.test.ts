import {act, create, type ReactTestRenderer} from 'react-test-renderer';
import {createElement} from 'react';

import {clearJournalCache, useJournalList} from '@/hooks/useJournalList';
import {fetchBlogs} from '@/services/blogApi';

jest.mock('@/services/blogApi', () => ({fetchBlogs: jest.fn()}));

const mockFetch = fetchBlogs as jest.Mock;

/** 훅만 돌리는 최소 렌더러 — @testing-library 없이 react-test-renderer로 충분하다 */
function renderHook<T>(hook: () => T) {
  const result = {current: undefined as unknown as T};

  function Probe() {
    result.current = hook();
    return null;
  }

  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(createElement(Probe));
  });

  return {result, unmount: () => act(() => renderer.unmount())};
}

const blog = (id: string) => ({
  id,
  date: '2026-08-05',
  title: `제목 ${id}`,
  summary: null,
  thumbnail_url: null,
  is_published: false,
  created_at: '2026-08-05T00:00:00Z',
});

const page = (ids: string[], total: number) => ({
  total,
  page: 1,
  size: 20,
  blogs: ids.map(blog),
});

/** 대기 중인 타이머를 흘리고 promise를 처리한다 */
async function flush(ms = 0) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
}

describe('useJournalList', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockFetch.mockReset();
    // 모듈 레벨 캐시라 테스트 사이에 남는다 — 앞 테스트 결과가 다음 초기 상태가 된다
    clearJournalCache();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('첫 진입에 목록을 받아온다 — 검색어가 없으면 기다리지 않는다', async () => {
    mockFetch.mockResolvedValue(page(['a', 'b'], 2));

    const {result} = renderHook(() => useJournalList());
    await flush();

    expect(mockFetch).toHaveBeenCalledWith({q: undefined, page: 1, size: 20});
    expect(result.current.journals).toHaveLength(2);
    expect(result.current.isLoading).toBe(false);
  });

  it('검색은 서버에 맡긴다 — 받아온 페이지 안에서 거르지 않는다', async () => {
    mockFetch.mockResolvedValue(page(['a'], 1));
    const {result} = renderHook(() => useJournalList());
    await flush();

    act(() => result.current.setQuery('여행'));
    await flush(300);

    expect(mockFetch).toHaveBeenLastCalledWith({
      q: '여행',
      page: 1,
      size: 20,
    });
  });

  it('타이핑 중에는 요청하지 않는다 (디바운스)', async () => {
    mockFetch.mockResolvedValue(page([], 0));
    const {result} = renderHook(() => useJournalList());
    await flush();
    mockFetch.mockClear();

    act(() => result.current.setQuery('여'));
    await flush(100);
    act(() => result.current.setQuery('여행'));
    await flush(100);
    act(() => result.current.setQuery('여행기'));
    await flush(300);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith({q: '여행기', page: 1, size: 20});
  });

  it('늦게 온 이전 검색 응답이 최신 결과를 덮어쓰지 않는다', async () => {
    let resolveSlow: (v: unknown) => void = () => {};
    mockFetch
      .mockResolvedValueOnce(page([], 0)) // 첫 진입
      .mockImplementationOnce(
        () => new Promise(resolve => (resolveSlow = resolve)), // 느린 '여행'
      )
      .mockResolvedValueOnce(page(['new'], 1)); // 빠른 '카페'

    const {result} = renderHook(() => useJournalList());
    await flush();

    act(() => result.current.setQuery('여행'));
    await flush(300);

    act(() => result.current.setQuery('카페'));
    await flush(300);

    // 뒤늦게 '여행' 응답이 도착
    await act(async () => {
      resolveSlow(page(['stale'], 1));
      await Promise.resolve();
    });

    expect(result.current.journals.map(j => j.id)).toEqual(['new']);
  });

  it('더 불러오면 다음 페이지를 이어붙인다', async () => {
    mockFetch
      .mockResolvedValueOnce(page(['a', 'b'], 4))
      .mockResolvedValueOnce({...page(['c', 'd'], 4), page: 2});

    const {result} = renderHook(() => useJournalList());
    await flush();

    expect(result.current.hasMore).toBe(true);

    act(() => result.current.loadMore());
    await flush();

    expect(mockFetch).toHaveBeenLastCalledWith({
      q: undefined,
      page: 2,
      size: 20,
    });
    expect(result.current.journals.map(j => j.id)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
    expect(result.current.hasMore).toBe(false);
  });

  it('다 불러왔으면 더 요청하지 않는다', async () => {
    mockFetch.mockResolvedValue(page(['a'], 1));
    const {result} = renderHook(() => useJournalList());
    await flush();
    mockFetch.mockClear();

    act(() => result.current.loadMore());
    await flush();

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('첫 페이지 조회에 실패하면 빈 목록이 된다', async () => {
    mockFetch.mockRejectedValue(new Error('network'));

    const {result} = renderHook(() => useJournalList());
    await flush();

    expect(result.current.journals).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('더 불러오기에 실패해도 이미 받은 목록은 유지한다', async () => {
    mockFetch
      .mockResolvedValueOnce(page(['a', 'b'], 4))
      .mockRejectedValueOnce(new Error('network'));

    const {result} = renderHook(() => useJournalList());
    await flush();

    act(() => result.current.loadMore());
    await flush();

    expect(result.current.journals.map(j => j.id)).toEqual(['a', 'b']);
    expect(result.current.isLoadingMore).toBe(false);
  });

  // 탭 레이아웃이 Slot이라 홈↔저널을 오갈 때마다 이 화면이 언마운트된다.
  // 캐시가 없으면 돌아올 때마다 스피너를 보고 기다려야 했다.
  describe('첫 페이지 캐시', () => {
    it('다시 마운트하면 스피너 없이 지난 목록부터 보여준다', async () => {
      mockFetch.mockResolvedValue(page(['a', 'b'], 2));
      const first = renderHook(() => useJournalList());
      await flush();
      first.unmount();

      const {result} = renderHook(() => useJournalList());

      // 네트워크를 기다리기 전에 이미 목록이 있다
      expect(result.current.journals.map(j => j.id)).toEqual(['a', 'b']);
      expect(result.current.isLoading).toBe(false);

      await flush();
    });

    it('검색 결과는 캐시하지 않는다 — 검색어와 짝이 안 맞는 목록이 뜬다', async () => {
      mockFetch.mockResolvedValue(page(['a'], 1));
      const first = renderHook(() => useJournalList());
      await flush();

      mockFetch.mockResolvedValue(page(['searched'], 1));
      act(() => first.result.current.setQuery('여행'));
      await flush(300);
      first.unmount();

      const {result} = renderHook(() => useJournalList());

      // 검색 결과가 아니라 검색 전 목록이 남아 있어야 한다
      expect(result.current.journals.map(j => j.id)).toEqual(['a']);

      await flush();
    });

    it('첫 페이지 조회에 실패하면 캐시를 지운다 — 옛 목록이 되살아나면 안 된다', async () => {
      mockFetch.mockResolvedValue(page(['a'], 1));
      const first = renderHook(() => useJournalList());
      await flush();
      first.unmount();

      mockFetch.mockRejectedValue(new Error('network'));
      const second = renderHook(() => useJournalList());
      await flush();
      second.unmount();

      const {result} = renderHook(() => useJournalList());

      expect(result.current.journals).toEqual([]);
      expect(result.current.isLoading).toBe(true);

      await flush();
    });

    it('clearJournalCache 후에는 처음처럼 스피너부터 보여준다', async () => {
      mockFetch.mockResolvedValue(page(['a'], 1));
      const first = renderHook(() => useJournalList());
      await flush();
      first.unmount();

      clearJournalCache();
      const {result} = renderHook(() => useJournalList());

      expect(result.current.journals).toEqual([]);
      expect(result.current.isLoading).toBe(true);

      await flush();
    });
  });
});
