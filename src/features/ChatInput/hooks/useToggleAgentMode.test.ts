import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ModelDisplayConfig } from '@/types/modelDisplay';

import { useToggleAgentMode } from './useToggleAgentMode';

const testState = vi.hoisted(() => ({
  access: {
    canManageAgent: false,
    isAccessLoading: false,
  },
  agent: {
    current: undefined as { visibility?: 'private' | 'public'; workspaceId?: string } | undefined,
  },
  aiInfra: {
    enabledChatModelList: [
      {
        children: [
          { id: 'first-agent-model' },
          { id: 'agent-default' },
          { id: 'chat-default' },
          { id: 'shared-model' },
        ],
        id: 'openai',
      },
    ],
  },
  businessCanEnable: true,
  canSelectModel: true,
  chatInput: {
    topicModelScope: true,
  },
  chat: {
    activeTopicId: undefined as string | undefined,
    activeTopicModel: undefined as { model: string; provider: string } | undefined,
    updateTopicModel: vi.fn(),
  },
  currentModel: { model: 'shared-model', provider: 'openai' },
  modelDisplayConfig: {
    agent: [
      { enabled: true, model: 'first-agent-model', provider: 'openai' },
      { enabled: true, model: 'agent-default', provider: 'openai' },
      { enabled: true, model: 'shared-model', provider: 'openai' },
    ],
    chat: [
      { enabled: true, model: 'chat-default', provider: 'openai' },
      { enabled: true, model: 'shared-model', provider: 'openai' },
    ],
    defaults: {
      agent: { model: 'agent-default', provider: 'openai' },
      chat: { model: 'chat-default', provider: 'openai' },
    },
  } as ModelDisplayConfig | undefined,
  refreshModelDisplayConfig: vi.fn(),
  selectModel: vi.fn(),
  updateAgentChatConfig: vi.fn(),
  updateWorkspaceUserPreference: vi.fn(),
}));

vi.mock('@/_custom/hooks/useCottiModelDisplayConfig', () => ({
  useCottiModelDisplayConfig: () => ({
    data: testState.modelDisplayConfig,
    mutate: testState.refreshModelDisplayConfig,
  }),
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

vi.mock('@/store/aiInfra', () => ({
  useAiInfraStore: (selector: (s: typeof testState.aiInfra) => unknown) =>
    selector(testState.aiInfra),
}));

vi.mock('@/store/chat', () => ({
  useChatStore: (selector: (s: typeof testState.chat) => unknown) => selector(testState.chat),
}));

vi.mock('@/store/chat/slices/topic/selectors', () => ({
  topicSelectors: {
    activeTopicModel: (state: typeof testState.chat) => state.activeTopicModel,
  },
}));

vi.mock('../store', () => ({
  useChatInputStore: (selector: (s: typeof testState.chatInput) => unknown) =>
    selector(testState.chatInput),
}));

vi.mock('@/store/user', () => ({
  useUserStore: (
    selector: (s: {
      updateWorkspaceUserPreference: typeof testState.updateWorkspaceUserPreference;
    }) => unknown,
  ) => selector({ updateWorkspaceUserPreference: testState.updateWorkspaceUserPreference }),
}));

vi.mock('./useAgentId', () => ({
  useAgentId: () => 'agent-1',
}));

vi.mock('./useAgentModelSelection', () => ({
  useAgentModelSelection: () => ({
    canSelectModel: testState.canSelectModel,
    model: testState.currentModel.model,
    provider: testState.currentModel.provider,
    selectModel: testState.selectModel,
  }),
}));

vi.mock('./useUpdateAgentConfig', () => ({
  useUpdateAgentConfig: () => ({ updateAgentChatConfig: testState.updateAgentChatConfig }),
}));

describe('useToggleAgentMode', () => {
  beforeEach(() => {
    testState.access.canManageAgent = false;
    testState.access.isAccessLoading = false;
    testState.chatInput.topicModelScope = true;
    testState.agent.current = undefined;
    testState.aiInfra.enabledChatModelList = [
      {
        children: [
          { id: 'first-agent-model' },
          { id: 'agent-default' },
          { id: 'chat-default' },
          { id: 'shared-model' },
        ],
        id: 'openai',
      },
    ];
    testState.businessCanEnable = true;
    testState.canSelectModel = true;
    testState.chat.activeTopicId = undefined;
    testState.chat.activeTopicModel = undefined;
    testState.chat.updateTopicModel = vi.fn();
    testState.currentModel = { model: 'shared-model', provider: 'openai' };
    testState.modelDisplayConfig = {
      agent: [
        { enabled: true, model: 'first-agent-model', provider: 'openai' },
        { enabled: true, model: 'agent-default', provider: 'openai' },
        { enabled: true, model: 'shared-model', provider: 'openai' },
      ],
      chat: [
        { enabled: true, model: 'chat-default', provider: 'openai' },
        { enabled: true, model: 'shared-model', provider: 'openai' },
      ],
      defaults: {
        agent: { model: 'agent-default', provider: 'openai' },
        chat: { model: 'chat-default', provider: 'openai' },
      },
    };
    testState.refreshModelDisplayConfig = vi.fn().mockResolvedValue(testState.modelDisplayConfig);
    testState.selectModel = vi.fn();
    testState.updateAgentChatConfig = vi.fn();
    testState.updateWorkspaceUserPreference = vi.fn();
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

    let applied: boolean | undefined;
    await act(async () => {
      applied = await result.current(true);
    });

    expect(applied).toBe(false);
    expect(testState.updateAgentChatConfig).not.toHaveBeenCalled();
    expect(testState.updateWorkspaceUserPreference).not.toHaveBeenCalled();
  });

  it('switches to the explicit Agent default when the Chat model is unavailable in Agent mode', async () => {
    testState.currentModel = { model: 'chat-default', provider: 'openai' };
    const { result } = renderHook(() => useToggleAgentMode());

    await act(() => result.current(true));

    expect(testState.selectModel).toHaveBeenCalledWith({
      model: 'agent-default',
      provider: 'openai',
    });
    expect(testState.selectModel).not.toHaveBeenCalledWith({
      model: 'first-agent-model',
      provider: 'openai',
    });
    expect(testState.updateAgentChatConfig).toHaveBeenCalledWith({ enableAgentMode: true });
    expect(testState.selectModel.mock.invocationCallOrder[0]).toBeLessThan(
      testState.updateAgentChatConfig.mock.invocationCallOrder[0],
    );
  });

  it('pins the Agent default to the active Topic before switching modes', async () => {
    testState.chat.activeTopicId = 'topic-1';
    testState.chat.activeTopicModel = { model: 'chat-default', provider: 'openai' };
    const { result } = renderHook(() => useToggleAgentMode());

    await act(() => result.current(true));

    expect(testState.chat.updateTopicModel).toHaveBeenCalledWith('topic-1', {
      model: 'agent-default',
      provider: 'openai',
    });
    expect(testState.selectModel).not.toHaveBeenCalled();
    expect(testState.updateAgentChatConfig).toHaveBeenCalledWith({ enableAgentMode: true });
  });

  it('ignores the globally active Topic when the input disables topic model scope', async () => {
    testState.chatInput.topicModelScope = false;
    testState.currentModel = { model: 'agent-default', provider: 'openai' };
    testState.chat.activeTopicId = 'previous-topic';
    testState.chat.activeTopicModel = { model: 'shared-model', provider: 'openai' };
    const { result } = renderHook(() => useToggleAgentMode());

    await act(() => result.current(false));

    expect(testState.selectModel).toHaveBeenCalledWith({
      model: 'chat-default',
      provider: 'openai',
    });
    expect(testState.chat.updateTopicModel).not.toHaveBeenCalled();
  });

  it('loads the model display config on demand before applying the fallback', async () => {
    const config = testState.modelDisplayConfig!;
    testState.currentModel = { model: 'chat-default', provider: 'openai' };
    testState.modelDisplayConfig = undefined;
    testState.refreshModelDisplayConfig = vi.fn().mockResolvedValue(config);
    const { result } = renderHook(() => useToggleAgentMode());

    await act(() => result.current(true));

    expect(testState.refreshModelDisplayConfig).toHaveBeenCalledOnce();
    expect(testState.selectModel).toHaveBeenCalledWith({
      model: 'agent-default',
      provider: 'openai',
    });
    expect(testState.updateAgentChatConfig).toHaveBeenCalledWith({ enableAgentMode: true });
  });

  it('switches to the explicit Chat default when the Agent model is unavailable in Chat mode', async () => {
    testState.currentModel = { model: 'agent-default', provider: 'openai' };
    const { result } = renderHook(() => useToggleAgentMode());

    await act(() => result.current(false));

    expect(testState.selectModel).toHaveBeenCalledWith({
      model: 'chat-default',
      provider: 'openai',
    });
    expect(testState.updateAgentChatConfig).toHaveBeenCalledWith({ enableAgentMode: false });
  });

  it('keeps the current model when it is available in the target mode', async () => {
    const { result } = renderHook(() => useToggleAgentMode());

    await act(() => result.current(true));

    expect(testState.selectModel).not.toHaveBeenCalled();
    expect(testState.chat.updateTopicModel).not.toHaveBeenCalled();
    expect(testState.updateAgentChatConfig).toHaveBeenCalledWith({ enableAgentMode: true });
  });

  it('does not switch modes when the configured default is unavailable to the user', async () => {
    testState.currentModel = { model: 'chat-default', provider: 'openai' };
    testState.aiInfra.enabledChatModelList[0].children = [
      { id: 'chat-default' },
      { id: 'shared-model' },
    ];
    const { result } = renderHook(() => useToggleAgentMode());

    let applied: boolean | undefined;
    await act(async () => {
      applied = await result.current(true);
    });

    expect(applied).toBe(false);
    expect(testState.selectModel).not.toHaveBeenCalled();
    expect(testState.updateAgentChatConfig).not.toHaveBeenCalled();
  });
});
