// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCottiPlatformAudit } from './useCottiPlatformAudit';

const mocks = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  setSearchParams: vi.fn(),
}));

vi.mock('react-router', () => ({
  useSearchParams: () => [mocks.searchParams, mocks.setSearchParams],
}));

vi.mock('@/libs/swr', () => ({
  useClientDataSWR: () => ({ data: undefined, error: undefined, mutate: vi.fn() }),
}));

vi.mock('@/services/cottiPlatformAudit', () => ({
  cottiPlatformAuditService: {
    analyzeMessageRisk: vi.fn(),
    getDashboard: vi.fn(),
    getMessageDetail: vi.fn(),
  },
}));

describe('useCottiPlatformAudit search input', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.searchParams = new URLSearchParams();
    mocks.setSearchParams.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps typing local and writes the URL only after the debounce window', async () => {
    const { result } = renderHook(() => useCottiPlatformAudit());

    act(() => result.current.setQuery('alice'));

    expect(result.current.queryInput).toBe('alice');
    expect(mocks.setSearchParams).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(301));

    expect(mocks.setSearchParams).toHaveBeenCalledTimes(1);
    expect(mocks.setSearchParams.mock.calls[0][0].get('auditQ')).toBe('alice');
  });
});
