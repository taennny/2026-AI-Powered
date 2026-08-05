import {useCallback, useEffect, useRef, useState} from 'react';

import {fetchBlogs, type JournalData} from '@/services/blogApi';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * 저널 목록 — 서버 검색 + 페이지네이션.
 *
 * 검색을 클라에서 걸면 이미 받아온 페이지 안에서만 찾게 되므로 백엔드 `q`를 쓴다.
 * 타이핑마다 요청하지 않도록 디바운스하고, 늦게 도착한 응답이 최신 결과를
 * 덮어쓰지 않도록 요청 번호로 거른다.
 */
export function useJournalList() {
  const [query, setQuery] = useState('');
  const [journals, setJournals] = useState<JournalData[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const pageRef = useRef(1);
  const requestIdRef = useRef(0);

  const load = useCallback(async (q: string, page: number) => {
    const requestId = ++requestIdRef.current;

    if (page === 1) {
      setIsLoading(true);
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
    } catch {
      if (requestId !== requestIdRef.current) return;

      // 첫 페이지 실패는 빈 목록, 더 불러오기 실패는 기존 목록 유지
      if (page === 1) {
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
