import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useToggleAgentMode } from './useToggleAgentMode';

const testState = vi.hoisted(() => ({
  access: {
    canManageAgent: false,
    isAccessLoading: false,
  },
  agent: {
    current: undefined as { visibility?: 'private' | 'public'; workspaceId?: string } | undefined,
  },
  execution: {
    agencyConfig: { executionTarget: 'none' as string | undefined },
    canSelectExecutionTarget: true,
    isPreferenceLoading: false,
  },
  selectTarget: vi.fn(async () => true),
  switchScope: vi.fn(async () => true),
  businessCanEnable: true,
  updateAgentChatConfig: vi.fn(),
  updateWorkspaceUserPreference: vi.fn(),
}));

vi.mock('@/hooks/useEffectiveAgencyConfig', () => ({
  useEffectiveAgencyConfig: () => testState.execution,
}));
vi.mock('./useSelectExecutionTarget', () => ({
  useSelectExecutionTarget: () => testState.selectTarget,
}));
vi.mock('@/business/client/hooks/useBusinessAgentMode', () => ({
  useBusinessCanEnableAgentMode: () => testState.businessCanEnable,
}));

vi.mock('@/features/ResourcePermission/useAgentManagementAccess', () => ({
  useAgentManagementAccess: () => testState.access,
}));

vi.mock('@/store/agent', () => ({
  useAgentStore: (selector: (s: typeof testState.agent) => unknown) => selector(testState.agent),
}));

vi.mock('@/store/agent/selectors', () => ({
  agentByIdSelectors: {
    getAgentById: () => (s: typeof testState.agent) => s.current,
  },
}));

vi.mock('@/store/user', () => ({
  useUserStore: (
    selector: (s: {
      updateWorkspaceUserPreference: typeof testState.updateWorkspaceUserPreference;
    }) => unknown,
  ) => selector({ updateWorkspaceUserPreference: testState.updateWorkspaceUserPreference }),
}));

vi.mock('./useSwitchModelDisplayScope', () => ({
  useSwitchModelDisplayScope: () => testState.switchScope,
}));

vi.mock('./useAgentId', () => ({
  useAgentId: () => 'agent-1',
}));

vi.mock('./useUpdateAgentConfig', () => ({
  useUpdateAgentConfig: () => ({ updateAgentChatConfig: testState.updateAgentChatConfig }),
}));

describe('useToggleAgentMode', () => {
  beforeEach(() => {
    testState.access.canManageAgent = false;
    testState.access.isAccessLoading = false;
    testState.agent.current = undefined;
    testState.businessCanEnable = true;
    testState.execution.agencyConfig.executionTarget = 'none';
    testState.execution.canSelectExecutionTarget = true;
    testState.execution.isPreferenceLoading = false;
    testState.selectTarget.mockClear();
    testState.selectTarget.mockResolvedValue(true);
    testState.switchScope.mockResolvedValue(true);
    testState.updateAgentChatConfig = vi.fn();
    testState.updateWorkspaceUserPreference = vi.fn();
  });

  it('does not enable Agent mode when its model pool is unavailable', async () => {
    testState.switchScope.mockResolvedValue(false);
    const { result } = renderHook(() => useToggleAgentMode());
    await act(async () => {
      await result.current(true);
    });
    expect(testState.updateAgentChatConfig).not.toHaveBeenCalled();
    expect(testState.updateWorkspaceUserPreference).not.toHaveBeenCalled();
  });

  it('stores a public Workspace member mode as a personal preference', async () => {
    testState.agent.current = { visibility: 'public', workspaceId: 'workspace-1' };
    const { result } = renderHook(() => useToggleAgentMode());

    await act(() => result.current(false));

    expect(testState.updateWorkspaceUserPreference).toHaveBeenCalledWith({
      agentModeOverrides: { 'agent-1': false },
    });
    expect(testState.updateAgentChatConfig).not.toHaveBeenCalled();
  });

  it('updates the shared default for the author or Workspace admin', async () => {
    testState.access.canManageAgent = true;
    testState.agent.current = { visibility: 'public', workspaceId: 'workspace-1' };
    const { result } = renderHook(() => useToggleAgentMode());

    await act(() => result.current(true));

    expect(testState.updateAgentChatConfig).toHaveBeenCalledWith({ enableAgentMode: true });
    expect(testState.updateWorkspaceUserPreference).not.toHaveBeenCalled();
  });

  it('does not write while management access is unresolved', async () => {
    testState.access.isAccessLoading = true;
    testState.agent.current = { visibility: 'public', workspaceId: 'workspace-1' };
    const { result } = renderHook(() => useToggleAgentMode());

    await act(() => result.current(true));

    expect(testState.updateAgentChatConfig).not.toHaveBeenCalled();
    expect(testState.updateWorkspaceUserPreference).not.toHaveBeenCalled();
  });

  it('persists a cloud sandbox before enabling native web Agent mode from no device', async () => {
    const { result } = renderHook(() => useToggleAgentMode());
    await act(() => result.current(true));
    expect(testState.selectTarget).toHaveBeenCalledWith('sandbox');
  });
  it('does not enable Agent when saving the sandbox fails', async () => {
    testState.selectTarget.mockResolvedValue(false);
    const { result } = renderHook(() => useToggleAgentMode());
    await act(async () => {
      expect(await result.current(true)).toBe(false);
    });
    expect(testState.updateAgentChatConfig).not.toHaveBeenCalled();
  });

  it('preserves an existing sandbox target and does not enable execution for Chat', async () => {
    testState.execution.agencyConfig.executionTarget = 'sandbox';
    const { result } = renderHook(() => useToggleAgentMode());
    await act(() => result.current(true));
    expect(testState.selectTarget).not.toHaveBeenCalled();
    testState.execution.agencyConfig.executionTarget = 'none';
    await act(() => result.current(false));
    expect(testState.selectTarget).not.toHaveBeenCalled();
  });
});
