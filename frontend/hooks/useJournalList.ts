import {useCallback, useEffect, useRef, useState} from 'react';

import {fetchBlogs, type JournalData} from '@/services/blogApi';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * 검색 없는 첫 페이지만 캐시한다.
 *
 * 탭 레이아웃이 `Slot`이라 홈↔저널을 오갈 때마다 이 화면이 언마운트돼서,
 * 돌아올 때마다 스피너를 보고 기다려야 했다. 캐시를 초기값으로 깔면 즉시 목록이
 * 뜨고 갱신은 뒤에서 돈다.
 *
 * 검색 결과는 캐시하지 않는다 — 검색어와 짝이 맞지 않으면 엉뚱한 목록이 보인다.
 * 로그아웃 시 `(main)/_layout`이 비운다 — 다음 계정이 물려받으면 안 된다.
 */
let cachedFirstPage: {journals: JournalData[]; total: number} | null = null;

export function clearJournalCache(): void {
  cachedFirstPage = null;
}

/**
 * 저널 목록 — 서버 검색 + 페이지네이션.
 *
 * 검색을 클라에서 걸면 이미 받아온 페이지 안에서만 찾게 되므로 백엔드 `q`를 쓴다.
 * 타이핑마다 요청하지 않도록 디바운스하고, 늦게 도착한 응답이 최신 결과를
 * 덮어쓰지 않도록 요청 번호로 거른다.
 */
export function useJournalList() {
  const [query, setQuery] = useState('');
  const [journals, setJournals] = useState<JournalData[]>(
    () => cachedFirstPage?.journals ?? [],
  );
  const [total, setTotal] = useState(() => cachedFirstPage?.total ?? 0);
  // 캐시가 있으면 스피너 대신 그 목록부터 보여준다
  const [isLoading, setIsLoading] = useState(cachedFirstPage === null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const pageRef = useRef(1);
  const requestIdRef = useRef(0);

  // 스피너로 가릴지 판단하려면 현재 목록을 봐야 하는데, load는 의존성이 없는
  // useCallback이라 state를 직접 못 읽는다
  const journalsRef = useRef(journals);
  journalsRef.current = journals;

  const load = useCallback(async (q: string, page: number) => {
    const requestId = ++requestIdRef.current;

    if (page === 1) {
      // 이미 보여줄 목록이 있으면(캐시·이전 결과) 스피너로 덮지 않는다
      if (journalsRef.current.length === 0) setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const data = await fetchBlogs({
        q: q.trim() || undefined,
        page,
        size: PAGE_SIZE,
      });

      // 그 사이 검색어가 바뀌었으면 이 응답은 버린다
      if (requestId !== requestIdRef.current) return;

      setTotal(data.total);
      setJournals(prev => (page === 1 ? data.blogs : [...prev, ...data.blogs]));
      pageRef.current = page;

      // 검색 없는 첫 페이지만 — 다음 진입에서 바로 보여줄 용도
      if (page === 1 && !q.trim()) {
        cachedFirstPage = {journals: data.blogs, total: data.total};
      }
    } catch {
      if (requestId !== requestIdRef.current) return;

      // 첫 페이지 실패는 빈 목록, 더 불러오기 실패는 기존 목록 유지
      if (page === 1) {
        // 실패한 결과를 캐시에 남기면 다음 진입에서 옛 목록이 되살아난다
        if (!q.trim()) cachedFirstPage = null;
        setJournals([]);
        setTotal(0);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    // 첫 진입은 기다릴 이유가 없다 — 디바운스는 타이핑에만 건다
    const delay = query ? SEARCH_DEBOUNCE_MS : 0;
    const timer = setTimeout(() => {
      void load(query, 1);
    }, delay);

    return () => clearTimeout(timer);
  }, [query, load]);

  const hasMore = journals.length < total;

  const loadMore = useCallback(() => {
    if (isLoading || isLoadingMore || !hasMore) return;
    void load(query, pageRef.current + 1);
  }, [hasMore, isLoading, isLoadingMore, load, query]);

  return {
    query,
    setQuery,
    journals,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
  };
}
