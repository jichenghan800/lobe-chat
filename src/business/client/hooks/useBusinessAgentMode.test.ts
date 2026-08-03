import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as swr from '@/libs/swr';

import { useBusinessAgentModeVisibility } from './useBusinessAgentMode';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useBusinessAgentModeVisibility', () => {
  it('returns the resolved entry visibility', () => {
    const mutate = vi.fn();
    vi.spyOn(swr, 'useClientDataSWR').mockReturnValue({
      data: { visible: true },
      error: undefined,
      isLoading: false,
      mutate,
    } as never);

    const { result } = renderHook(() => useBusinessAgentModeVisibility());

    expect(result.current).toEqual({
      error: undefined,
      isLoading: false,
      isResolved: true,
      mutate,
      visible: true,
    });
  });

  it('keeps settled data during a background revalidation failure', () => {
    const error = new Error('network unavailable');
    const mutate = vi.fn();
    vi.spyOn(swr, 'useClientDataSWR').mockReturnValue({
      data: { visible: true },
      error,
      isLoading: false,
      mutate,
    } as never);

    const { result } = renderHook(() => useBusinessAgentModeVisibility());

    expect(result.current).toEqual({
      error,
      isLoading: false,
      isResolved: true,
      mutate,
      visible: true,
    });
  });

  it('fails closed while the first status request is unresolved', () => {
    const mutate = vi.fn();
    vi.spyOn(swr, 'useClientDataSWR').mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      mutate,
    } as never);

    const { result } = renderHook(() => useBusinessAgentModeVisibility());

    expect(result.current).toEqual({
      error: undefined,
      isLoading: true,
      isResolved: false,
      mutate,
      visible: false,
    });
  });
});
