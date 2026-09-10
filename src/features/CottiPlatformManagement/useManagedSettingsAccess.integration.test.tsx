import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { SWRConfig } from 'swr';
import { afterEach, expect, it, vi } from 'vitest';

import { useManagedSettingsAccess } from './useManagedSettingsAccess';

const service = vi.hoisted(() => ({ getAccess: vi.fn() }));
vi.mock('@/services/cottiPlatformAnalytics', () => ({ cottiPlatformAnalyticsService: service }));
vi.mock('@/business/client/hooks/useActiveWorkspaceId', () => ({
  useActiveWorkspaceId: () => undefined,
}));

afterEach(() => vi.unstubAllEnvs());

it('handles an actual 403 under the native settings suspense boundary as ordinary-user access', async () => {
  vi.stubEnv('NEXT_PUBLIC_COTTI_SHOW_PLATFORM_ANALYTICS', '1');
  service.getAccess.mockRejectedValue(
    Object.assign(new Error('denied'), { data: { code: 'FORBIDDEN', httpStatus: 403 } }),
  );
  const cache = new Map();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SWRConfig value={{ provider: () => cache, suspense: true, shouldRetryOnError: false }}>
      <Suspense fallback={null}>{children}</Suspense>
    </SWRConfig>
  );
  const { result } = renderHook(() => useManagedSettingsAccess(), { wrapper });
  await waitFor(() => expect(result.current?.data).toBe(false));
  expect(result.current).toMatchObject({ canManage: false, error: undefined, isLoading: false });
});
