import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  COTTI_AGENT_MODE_VISIBILITY_KEY,
  refreshBusinessAgentModeVisibility,
  useBusinessAgentModeVisibility,
} from './useBusinessAgentMode';

const mocks = vi.hoisted(() => ({
  globalMutate: vi.fn(),
  refresh: vi.fn(),
  useClientDataSWR: vi.fn(),
}));

vi.mock('@/libs/swr', () => ({
  mutate: mocks.globalMutate,
  useClientDataSWR: mocks.useClientDataSWR,
}));

vi.mock('@/services/cottiAgentAccess', () => ({
  cottiAgentAccessService: { getStatus: vi.fn() },
}));

describe('useBusinessAgentModeVisibility', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.useClientDataSWR.mockReturnValue({
      data: { visible: false },
      error: undefined,
      isLoading: false,
      mutate: mocks.refresh,
    });
  });

  it('periodically revalidates an already-open page and rechecks it on focus', () => {
    const { result } = renderHook(() => useBusinessAgentModeVisibility());

    expect(mocks.useClientDataSWR).toHaveBeenCalledWith(
      COTTI_AGENT_MODE_VISIBILITY_KEY,
      expect.any(Function),
      expect.objectContaining({ refreshInterval: 30_000, revalidateOnFocus: true }),
    );
    expect(result.current).toMatchObject({ isResolved: true, visible: false });
  });

  it('invalidates the same status key after an administrator changes access', async () => {
    await refreshBusinessAgentModeVisibility();

    expect(mocks.globalMutate).toHaveBeenCalledWith(COTTI_AGENT_MODE_VISIBILITY_KEY);
  });
});
