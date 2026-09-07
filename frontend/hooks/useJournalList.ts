import {useCallback, useEffect, useRef, useState} from 'react';

import {fetchBlogs, type JournalData} from '@/services/blogApi';

const PAGE_SIZE = 20;

/**
 * 검색 없는 첫 페이지만 캐시한다 — 탭 전환마다 언마운트돼서 스피너를 봐야 했다.
 * 검색 결과는 캐시하지 않는다(검색어와 짝이 어긋난다).
 * 로그아웃 시 `(main)/_layout`이 비운다.
 */
let cachedFirstPage: {journals: JournalData[]; total: number} | null = null;

export function clearJournalCache(): void {
  cachedFirstPage = null;
}

export function useJournalList() {
  const [query, setQuery] = useState('');
  // 캐시로 되살린 목록은 검색 없는 첫 페이지뿐이라 빈 문자열이 맞다
  const [appliedQuery, setAppliedQuery] = useState('');
  const [journals, setJournals] = useState<JournalData[]>(
    () => cachedFirstPage?.journals ?? [],
  );
  const [total, setTotal] = useState(() => cachedFirstPage?.total ?? 0);
  // 캐시가 있으면 스피너 대신 그 목록부터 보여준다
  const [isLoading, setIsLoading] = useState(cachedFirstPage === null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const pageRef = useRef(1);
  const requestIdRef = useRef(0);
  // 첫 페이지가 날아가는 중이면 '더 불러오기'를 막는다 — 그 사이 페이지 2를
  // 요청하면 번호가 더 커져서, 뒤에 도착한 첫 페이지 응답이 버려진다
  const isFirstPageLoadingRef = useRef(false);

  // load가 의존성 없는 useCallback이라 state를 직접 못 읽는다
  const journalsRef = useRef(journals);
  journalsRef.current = journals;

  const load = useCallback(async (q: string, page: number) => {
    const requestId = ++requestIdRef.current;

    if (page === 1) {
      isFirstPageLoadingRef.current = true;
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
      // 목록과 같은 순간에 바꾼다 — 하이라이트가 짝을 잃지 않는다
      setAppliedQuery(q);
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
        // 실패해도 빈 목록은 이 검색어의 결과다 — '검색 결과가 없어요'가 옛 검색어를 가리키면 안 된다
        setAppliedQuery(q);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
        setIsLoadingMore(false);
        if (page === 1) isFirstPageLoadingRef.current = false;
      }
    }
  }, []);

  // 첫 진입에 한 번. 이후 조회는 search()/clearSearch()/loadMore()가 시작한다
  useEffect(() => {
    void load('', 1);
  }, [load]);

  /** 검색 버튼·키보드 Search 키 */
  const search = useCallback(() => {
    void load(query, 1);
  }, [load, query]);

  /** 검색창을 닫을 때 — 검색어를 지우고 전체 목록으로 돌아온다 */
  const clearSearch = useCallback(() => {
    setQuery('');
    void load('', 1);
  }, [load]);

  const hasMore = journals.length < total;

  const loadMore = useCallback(() => {
    if (
      isLoading ||
      isLoadingMore ||
      isFirstPageLoadingRef.current ||
      !hasMore
    ) {
      return;
    }
    // 입력 중인 `query`가 아니라 이 목록을 만들어낸 검색어로 이어받는다
    void load(appliedQuery, pageRef.current + 1);
  }, [appliedQuery, hasMore, isLoading, isLoadingMore, load]);

  return {
    query,
    setQuery,
    appliedQuery,
    search,
    clearSearch,
    journals,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
  };
}
