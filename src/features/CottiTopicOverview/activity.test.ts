import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useOverviewActivity } from './hooks';

const state = vi.hoisted(() => ({
  data: { revision: '1' },
  options: {} as Record<string, unknown>,
}));
vi.mock('@/libs/swr', () => ({
  useClientDataSWR: (_key: unknown, _fetch: unknown, options: Record<string, unknown>) => {
    state.options = options;
    return { data: state.data };
  },
}));
vi.mock('@/services/cottiTopicOverview', () => ({
  cottiTopicOverviewService: { activity: vi.fn() },
}));

describe('overview activity polling', () => {
  beforeEach(() => {
    state.data = { revision: '1' };
  });
  it('refreshes the transcript only when its revision changes', () => {
    const refresh = vi.fn();
    const { rerender } = renderHook(() => useOverviewActivity('topic', refresh));
    rerender();
    expect(refresh).not.toHaveBeenCalled();
    state.data = { revision: '2' };
    rerender();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(state.options).toMatchObject({ refreshInterval: 5000, refreshWhenHidden: false });
  });
  it('does not treat switching topics as an update of the previous topic', () => {
    const refresh = vi.fn();
    const { rerender } = renderHook(({ id }) => useOverviewActivity(id, refresh), {
      initialProps: { id: 'a' },
    });
    state.data = { revision: '9' };
    rerender({ id: 'b' });
    expect(refresh).not.toHaveBeenCalled();
  });
});
