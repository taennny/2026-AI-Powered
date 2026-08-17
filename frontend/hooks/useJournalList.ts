import {useCallback, useEffect, useRef, useState} from 'react';

import {fetchBlogs, type JournalData} from '@/services/blogApi';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * 검색 없는 첫 페이지만 캐시한다 — 탭 전환마다 언마운트돼서 스피너를 봐야 했다.
 * 검색 결과는 캐시하지 않는다(검색어와 짝이 어긋난다).
 * 로그아웃 시 `(main)/_layout`이 비운다.
 */
let cachedFirstPage: {journals: JournalData[]; total: number} | null = null;

export function clearJournalCache(): void {
  cachedFirstPage = null;
}

/**
 * 저널 목록 — 서버 검색(`q`) + 페이지네이션.
 * 클라 검색은 받아온 페이지 안에서만 찾게 된다. 늦게 온 응답은 요청 번호로 거른다.
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

  // load가 의존성 없는 useCallback이라 state를 직접 못 읽는다
  const journalsRef = useRef(journals);
  journalsRef.current = journals;

  const load = useCallback(async (q: string, page: number) => {
    const requestId = ++requestIdRef.current;

    if (page === 1) {
      // 보여줄 목록이 있으면 스피너로 덮지 않는다
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

      if (requestId !== requestIdRef.current) return; // 검색어가 바뀌었다

      setTotal(data.total);
      setJournals(prev => (page === 1 ? data.blogs : [...prev, ...data.blogs]));
      pageRef.current = page;

      if (page === 1 && !q.trim()) {
        cachedFirstPage = {journals: data.blogs, total: data.total};
      }
    } catch {
      if (requestId !== requestIdRef.current) return;

      // 첫 페이지 실패는 빈 목록, 더 불러오기 실패는 기존 목록 유지
      if (page === 1) {
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
    // 디바운스는 타이핑에만 건다
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
