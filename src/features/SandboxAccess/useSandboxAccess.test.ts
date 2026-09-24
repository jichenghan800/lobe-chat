// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSandboxAccess } from './useSandboxAccess';

const mocks = vi.hoisted(() => ({
  preflight: vi.fn(),
  detail: vi.fn(),
  switchTopic: vi.fn(),
  refresh: vi.fn(),
  signIn: vi.fn(),
  pending: 'market',
  agency: { executionTarget: 'sandbox', boundDeviceId: undefined as string | undefined },
  choose: vi.fn(),
}));
vi.mock('@/helpers/gatewayMode', () => ({ useIsGatewayModeEnabled: () => true }));
vi.mock('@/hooks/useEffectiveAgencyConfig', () => ({
  useEffectiveAgencyConfig: () => ({ agencyConfig: mocks.agency, workspaceScoped: false }),
}));
vi.mock('@/layout/AuthProvider/MarketAuth', () => ({
  useMarketAuth: () => ({ signIn: mocks.signIn }),
}));
vi.mock('@/services/cottiSandbox', () => ({
  cottiSandboxService: { preflight: mocks.preflight, switchUnusedTopic: mocks.switchTopic },
}));
vi.mock('@/services/topic', () => ({ topicService: { getTopicDetail: mocks.detail } }));
vi.mock('@/store/chat', () => ({
  useChatStore: { getState: () => ({ refreshTopic: mocks.refresh }) },
}));
vi.mock('@/store/chat/pendingSandboxProvider', () => ({
  getPendingSandboxProvider: () => mocks.pending,
  setPendingSandboxProvider: (_: string, p: string) => {
    mocks.pending = p;
  },
}));
vi.mock('./modal', () => ({ chooseSandboxAccess: mocks.choose }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pending = 'market';
  mocks.agency.executionTarget = 'sandbox';
  mocks.agency.boundDeviceId = undefined;
  mocks.preflight.mockResolvedValue({
    cloud: 'auth_required',
    selfHostedAvailable: true,
    selfHostedFull: false,
  });
  mocks.choose.mockResolvedValue('cancel');
});
describe('sandbox access boundaries', () => {
  it('does not check or prompt when merely mounted', () => {
    renderHook(() => useSandboxAccess('agent'));
    expect(mocks.preflight).not.toHaveBeenCalled();
    expect(mocks.choose).not.toHaveBeenCalled();
  });
  it('leaves Chat mode independent of community login', async () => {
    const { result } = renderHook(() => useSandboxAccess('agent'));
    expect(
      await result.current({ agentId: 'agent', enabled: false, isCurrent: () => true }),
    ).toEqual({});
    expect(mocks.preflight).not.toHaveBeenCalled();
  });
  it('does not require community login for a new self-hosted topic', async () => {
    mocks.pending = 'onlyboxes';
    const { result } = renderHook(() => useSandboxAccess('agent'));
    expect(
      await result.current({ agentId: 'agent', enabled: true, isCurrent: () => true }),
    ).toEqual({});
    expect(mocks.preflight).not.toHaveBeenCalled();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });
  it('does not require community login for an existing self-hosted topic', async () => {
    mocks.detail.mockResolvedValue({ metadata: { sandboxProvider: 'onlyboxes' } });
    const { result } = renderHook(() => useSandboxAccess('agent'));
    expect(
      await result.current({
        agentId: 'agent',
        topicId: 'topic',
        enabled: true,
        isCurrent: () => true,
      }),
    ).toEqual({});
    expect(mocks.preflight).not.toHaveBeenCalled();
  });
  it('keeps explicitly selected devices outside sandbox auth', async () => {
    mocks.agency.executionTarget = 'device';
    const { result } = renderHook(() => useSandboxAccess('agent'));
    await result.current({ agentId: 'agent', enabled: true, isCurrent: () => true });
    expect(mocks.preflight).not.toHaveBeenCalled();
  });
  it('does not gate a bound local device shown as a remote device on web', async () => {
    mocks.agency.executionTarget = 'local';
    mocks.agency.boundDeviceId = 'device-test';
    const { result } = renderHook(() => useSandboxAccess('agent'));
    await result.current({ agentId: 'agent', enabled: true, isCurrent: () => true });
    expect(mocks.preflight).not.toHaveBeenCalled();
  });
  it('only switches the current topic after explicit fallback selection', async () => {
    mocks.detail.mockResolvedValue({ metadata: { sandboxProvider: 'market' } });
    mocks.choose.mockResolvedValue('selfHosted');
    mocks.switchTopic.mockResolvedValue({ status: 'switched' });
    const { result } = renderHook(() => useSandboxAccess('agent'));
    expect(
      await result.current({
        agentId: 'agent',
        topicId: 'topic',
        enabled: true,
        isCurrent: () => true,
      }),
    ).toEqual({ newTopic: false });
    expect(mocks.switchTopic).toHaveBeenCalledWith('topic', 'onlyboxes');
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
});
