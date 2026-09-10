import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useToolStore } from '@/store/tool';

import { useInstalledSkillsAndTools } from './useInstalledSkillsAndTools';

const mocks = vi.hoisted(() => ({ query: vi.fn(), enabled: true }));
vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: { composio: { getComposioPlugins: { query: mocks.query } } },
  toolsClient: {},
}));

const wrapper = () => {
  const value = { provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false };
  return ({ children }: { children: ReactNode }) => createElement(SWRConfig, { value }, children);
};
const activePlugin = {
  identifier: 'gmail',
  customParams: {
    composio: {
      appSlug: 'gmail',
      authConfigId: 'auth',
      connectedAccountId: 'active-account',
      status: 'ACTIVE',
    },
  },
  manifest: {
    api: [{ name: 'GMAIL_FETCH_EMAILS', description: 'Read mail', parameters: { type: 'object' } }],
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.enabled = true;
  mocks.query.mockResolvedValue([activePlugin]);
  useToolStore.setState({ composioServers: [], isComposioServersInit: false });
});
afterEach(() => {
  useToolStore.setState({ composioServers: [], isComposioServersInit: false });
});

vi.mock('@/store/serverConfig', () => ({
  useServerConfigStore: (
    selector: (state: { serverConfig: { enableComposio: boolean } }) => unknown,
  ) => selector({ serverConfig: { enableComposio: mocks.enabled } }),
}));

describe('Composio mention entry', () => {
  it('loads and shows Gmail from an empty store without mounting the Tools popover', async () => {
    const { result } = renderHook(() => useInstalledSkillsAndTools(), { wrapper: wrapper() });
    await waitFor(() =>
      expect(result.current).toContainEqual(
        expect.objectContaining({ category: 'tool', label: 'Gmail', type: 'gmail' }),
      ),
    );
  });
  it('does not request Composio connections while the server capability is disabled', () => {
    mocks.enabled = false;
    renderHook(() => useInstalledSkillsAndTools(), { wrapper: wrapper() });
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
