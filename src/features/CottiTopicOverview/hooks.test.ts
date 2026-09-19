import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCottiTopicOverviewList } from './hooks';

const mocks = vi.hoisted(() => ({ list: vi.fn(), initialSearch: '' }));
vi.mock('react-router', () => ({
  useSearchParams: () => useState(new URLSearchParams(mocks.initialSearch)),
}));
vi.mock('@/services/cottiTopicOverview', () => ({
  cottiTopicOverviewService: { list: mocks.list },
}));
vi.mock('@/libs/swr', () => ({
  useClientDataSWR: (_key: unknown, fetcher: () => unknown) => {
    fetcher();
    return {};
  },
}));

beforeEach(() => {
  mocks.initialSearch = '';
  mocks.list.mockClear();
});

describe('overview pasted link search', () => {
  it('keeps the full URL visible while querying its topic ID across freeze states', async () => {
    const link = `https://chat.cotti.ai/agent/agt_wBr9xdY8Oxqm/tpc_t1SSaYPz2nK5?ref=${'x'.repeat(180)}`;
    const { result } = renderHook(() => useCottiTopicOverviewList());
    act(() => result.current.setQueryInput(link));
    await waitFor(() => {
      expect(result.current.state.q).toBe(link);
      expect(result.current.state.status).toBe('all');
      expect(mocks.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: 'tpc_t1SSaYPz2nK5', status: 'all' }),
      );
    });
    expect(result.current.queryInput).toBe(link);
  });

  it('searches frozen topics by title, then allows an explicit freeze filter', async () => {
    mocks.initialSearch = 'status=frozen';
    const { result } = renderHook(() => useCottiTopicOverviewList());
    act(() => result.current.setQueryInput('比赛讲稿'));
    await waitFor(() => {
      expect(mocks.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: '比赛讲稿', status: 'all' }),
      );
    });
    expect(result.current.queryInput).toBe('比赛讲稿');
    act(() => result.current.setStatus('frozen'));
    await waitFor(() => {
      expect(mocks.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: '比赛讲稿', status: 'frozen' }),
      );
    });
  });
});

describe('overview default filters', () => {
  it.each(['', 'sort=invalid&status=invalid'])(
    'defaults to all topics ordered by recent update: %s',
    (search) => {
      mocks.initialSearch = search;
      const { result } = renderHook(() => useCottiTopicOverviewList());
      expect(result.current.state).toMatchObject({ status: 'all', sort: 'updated', page: 1 });
      expect(mocks.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'all', sort: 'updated' }),
      );
    },
  );

  it('preserves explicit filters in bookmarked URLs', () => {
    mocks.initialSearch = 'status=frozen&sort=cost&page=2';
    const { result } = renderHook(() => useCottiTopicOverviewList());
    expect(result.current.state).toMatchObject({ status: 'frozen', sort: 'cost', page: 2 });
  });
});
