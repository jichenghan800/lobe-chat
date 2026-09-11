import { useDebounce } from 'ahooks';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useClientDataSWR } from '@/libs/swr';
import { cottiTopicOverviewService } from '@/services/cottiTopicOverview';
import type { CottiTopicOverviewQuery } from '@/types/cotti/topicOverview';

const parsePage = (value: string | null) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

export const useCottiTopicOverviewList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = useMemo(
    () => ({
      page: parsePage(searchParams.get('page')),
      q: searchParams.get('q')?.trim() ?? '',
      status: (['active', 'frozen', 'all'].includes(searchParams.get('status') ?? '')
        ? searchParams.get('status')
        : 'active') as 'active' | 'frozen' | 'all',
    }),
    [searchParams],
  );
  const [queryInput, setQueryInput] = useState(state.q);
  const debouncedQuery = useDebounce(queryInput, { wait: 300 });
  const query = {
    status: state.status,
    page: state.page,
    pageSize: 50,
    q: state.q || undefined,
  } as const satisfies CottiTopicOverviewQuery;

  useEffect(() => {
    setQueryInput(state.q);
  }, [state.q]);

  useEffect(() => {
    if (debouncedQuery.trim() === state.q) return;
    const next = new URLSearchParams(searchParams);
    const normalizedQuery = debouncedQuery.trim();
    if (normalizedQuery) next.set('q', normalizedQuery);
    else next.delete('q');
    next.delete('page');
    setSearchParams(next, { replace: true });
  }, [debouncedQuery, searchParams, setSearchParams, state.q]);

  const swr = useClientDataSWR(
    ['cotti', 'topic-overview', 'list', query.q ?? '', query.page, query.pageSize, query.status],
    () => cottiTopicOverviewService.list(query),
    { keepPreviousData: true, revalidateOnFocus: false },
  );

  return {
    setStatus: (status: 'active' | 'frozen' | 'all') => {
      const next = new URLSearchParams(searchParams);
      next.set('status', status);
      next.delete('page');
      setSearchParams(next);
    },
    queryInput,
    setPage: (page: number) => {
      const next = new URLSearchParams(searchParams);
      if (page > 1) next.set('page', String(page));
      else next.delete('page');
      setSearchParams(next);
    },
    setQueryInput,
    state,
    swr,
  };
};

export const useCottiTopicOverviewDetail = (topicId?: string) => {
  const openedAt = useMemo(() => ({ topicId, time: Date.now() }), [topicId]);
  return useClientDataSWR(
    topicId ? ['cotti', 'topic-overview', 'detail', topicId, openedAt.time] : null,
    () => cottiTopicOverviewService.getDetail(topicId!),
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );
};

export const useCottiTopicAccounting = (topicId: string) =>
  useClientDataSWR(
    ['cotti', 'topic-accounting', topicId],
    () => cottiTopicOverviewService.accounting(topicId),
    { refreshInterval: 15000, revalidateOnFocus: true },
  );
