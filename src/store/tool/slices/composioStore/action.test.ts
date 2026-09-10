import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useToolStore } from '@/store/tool';
import type { ComposioServer } from '@/store/tool/slices/composioStore/types';
import { ComposioServerStatus } from '@/store/tool/slices/composioStore/types';

const mocks = vi.hoisted(() => ({ query: vi.fn(), enabled: true }));
vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: { composio: { getComposioPlugins: { query: mocks.query } } },
  toolsClient: {},
}));

const wrapper = () => {
  const value = { provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false };
  return ({ children }: { children: ReactNode }) => createElement(SWRConfig, { value }, children);
};
const server = (agentId?: string): ComposioServer => ({
  agentId,
  appSlug: 'gmail',
  authConfigId: 'auth',
  connectedAccountId: 'old-account',
  createdAt: 0,
  identifier: 'gmail',
  label: 'Gmail',
  status: ComposioServerStatus.PENDING_AUTH,
});
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

describe('personal Composio snapshot refresh', () => {
  const mount = (enabled = true) =>
    renderHook(() => useToolStore.getState().useFetchUserComposioConnections(enabled), {
      wrapper: wrapper(),
    });
  it('replaces pending status, account and tools with the server snapshot', async () => {
    useToolStore.setState({ composioServers: [server()] });
    mount();
    await waitFor(() =>
      expect(useToolStore.getState().composioServers[0]).toMatchObject({
        status: ComposioServerStatus.ACTIVE,
        connectedAccountId: 'active-account',
        tools: [expect.objectContaining({ name: 'GMAIL_FETCH_EMAILS' })],
      }),
    );
  });
  it('removes a personal connection after the endpoint returns an empty snapshot', async () => {
    const { result } = mount();
    await waitFor(() => expect(useToolStore.getState().composioServers).toHaveLength(1));
    mocks.query.mockResolvedValue([]);
    await act(async () => {
      await result.current.mutate();
    });
    expect(useToolStore.getState().composioServers).toEqual([]);
  });
  it('preserves an agent connection with the same identifier while updating the personal one', async () => {
    const agent = server('agent-1');
    useToolStore.setState({ composioServers: [server(), agent] });
    mount();
    await waitFor(() => expect(useToolStore.getState().isComposioServersInit).toBe(true));
    expect(useToolStore.getState().composioServers).toEqual([
      expect.objectContaining({
        connectedAccountId: 'active-account',
        status: ComposioServerStatus.ACTIVE,
      }),
      agent,
    ]);
  });
  it('keeps agent connections when all personal connections have been removed', async () => {
    const agent = server('agent-1');
    useToolStore.setState({ composioServers: [server(), agent] });
    mocks.query.mockResolvedValue([]);
    mount();
    await waitFor(() => expect(useToolStore.getState().isComposioServersInit).toBe(true));
    expect(useToolStore.getState().composioServers).toEqual([agent]);
  });
  it('does not erase existing state when the request fails', async () => {
    const existing = server();
    useToolStore.setState({ composioServers: [existing] });
    mocks.query.mockRejectedValue(new Error('network unavailable'));
    const { result } = mount();
    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(useToolStore.getState().composioServers).toEqual([existing]);
  });
});
