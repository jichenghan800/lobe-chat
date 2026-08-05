import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useToolStore } from '@/store/tool';
import { ComposioServerStatus } from '@/store/tool/slices/composioStore';

import { useInstalledSkillsAndTools } from './useInstalledSkillsAndTools';

vi.mock('@/store/serverConfig', () => ({
  useServerConfigStore: (
    selector: (state: { serverConfig: { enableComposio: boolean } }) => unknown,
  ) => selector({ serverConfig: { enableComposio: true } }),
}));

describe('useInstalledSkillsAndTools', () => {
  const originalFetch = useToolStore.getState().useFetchUserComposioConnections;
  const fetchComposioConnections = vi.fn(() => ({}) as never);

  beforeEach(() => {
    fetchComposioConnections.mockClear();
    useToolStore.setState({
      composioServers: [
        {
          appSlug: 'gmail',
          authConfigId: 'auth-gmail',
          connectedAccountId: 'account-gmail',
          createdAt: 0,
          identifier: 'gmail',
          label: 'Gmail',
          status: ComposioServerStatus.ACTIVE,
        },
      ],
      useFetchUserComposioConnections: fetchComposioConnections,
    });
  });

  afterEach(() => {
    useToolStore.setState({
      composioServers: [],
      useFetchUserComposioConnections: originalFetch,
    });
  });

  it('loads Composio connections from the mention entry point and exposes Gmail', () => {
    const { result } = renderHook(() => useInstalledSkillsAndTools());

    expect(fetchComposioConnections).toHaveBeenCalledWith(true);
    expect(result.current).toContainEqual(
      expect.objectContaining({ category: 'tool', label: 'Gmail', type: 'gmail' }),
    );
  });
});
