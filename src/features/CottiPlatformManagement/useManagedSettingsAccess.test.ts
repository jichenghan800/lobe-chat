import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useManagedSettingsAccess } from './useManagedSettingsAccess';

const access = vi.hoisted(() => ({
  enabled: true,
  swr: {
    data: undefined as { isAdmin: boolean } | undefined,
    error: undefined as Error | undefined,
    mutate: vi.fn(),
  },
}));
vi.mock('@/features/CottiPlatformAnalytics/hooks', () => ({
  useCottiPlatformAdminAccess: () => access,
}));

describe('managed settings access lifecycle', () => {
  it('resolves loading, non-admin, admin and retryable error without exposing UI while loading', () => {
    const { result, rerender } = renderHook(() => useManagedSettingsAccess());
    expect(result.current).toMatchObject({ canManage: false, isLoading: true });
    access.swr.error = new Error('network');
    rerender();
    expect(result.current).toMatchObject({
      canManage: false,
      isLoading: false,
      error: access.swr.error,
      retry: access.swr.mutate,
    });
    access.swr.error = Object.assign(new Error('forbidden'), { data: { code: 'FORBIDDEN' } });
    rerender();
    expect(result.current).toMatchObject({
      canManage: false,
      isLoading: false,
      error: undefined,
      data: false,
    });
    access.swr.error = undefined;
    access.swr.data = { isAdmin: false };
    rerender();
    expect(result.current).toMatchObject({ canManage: false, isLoading: false });
    access.swr.data = { isAdmin: true };
    rerender();
    expect(result.current.canManage).toBe(true);
    access.enabled = false;
    access.swr.data = undefined;
    rerender();
    expect(result.current).toMatchObject({ canManage: true, isLoading: false, data: true });
  });
});
