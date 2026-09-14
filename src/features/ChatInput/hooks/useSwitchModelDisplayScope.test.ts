import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSwitchModelDisplayScope } from './useSwitchModelDisplayScope';

const state = vi.hoisted(() => ({
  scope: true,
  loading: false,
  topicModel: { model: 'fast', provider: 'test' },
  savedTopic: { model: 'fast', provider: 'test' },
  selected: { model: 'professional', provider: 'test' },
  canSelect: true,
  selectModel: vi.fn(),
  updateTopicModel: vi.fn(),
}));
vi.mock('../store', () => ({
  useChatInputStore: (selector: (s: { topicModelScope: boolean }) => unknown) =>
    selector({ topicModelScope: state.scope }),
}));
vi.mock('./useAgentId', () => ({ useAgentId: () => 'agent' }));
vi.mock('./useAgentModelSelection', () => ({
  useAgentModelSelection: () => ({
    ...state.selected,
    canSelectModel: state.canSelect,
    selectModel: state.selectModel,
  }),
}));
vi.mock('@/store/chat', () => ({
  useChatStore: (selector: (s: unknown) => unknown) =>
    selector({ activeTopicId: 'topic', updateTopicModel: state.updateTopicModel }),
}));
vi.mock('@/store/chat/slices/topic/selectors', () => ({
  topicSelectors: {
    activeTopicModel: () => (state.loading ? undefined : state.topicModel),
    isActiveTopicModelLoading: () => state.loading,
  },
}));
vi.mock('@/store/aiInfra', () => {
  const store = {
    enabledChatModelList: [
      {
        id: 'test',
        children: [{ id: 'fast' }, { id: 'professional' }, { id: 'other-agent-model' }],
      },
    ],
  };
  return {
    useAiInfraStore: Object.assign((selector: (s: typeof store) => unknown) => selector(store), {
      getState: () => store,
    }),
  };
});
vi.mock('@/_custom/hooks/useCottiModelDisplayConfig', () => ({
  useCottiModelDisplayConfig: () => ({
    data: {
      chat: [{ model: 'fast', provider: 'test', enabled: true }],
      agent: ['professional', 'other-agent-model'].map((model) => ({
        model,
        provider: 'test',
        enabled: true,
      })),
      defaults: {
        chat: { model: 'fast', provider: 'test' },
        agent: { model: 'professional', provider: 'test' },
      },
    },
    mutate: vi.fn(),
  }),
}));

describe('mode model persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.scope = true;
    state.loading = false;
    state.canSelect = true;
    state.topicModel = { model: 'fast', provider: 'test' };
    state.savedTopic = { ...state.topicModel };
    state.updateTopicModel.mockImplementation(async (_id, model) => {
      state.savedTopic = model;
    });
  });
  it('replaces a chat-only topic pin with the Agent default, not just the Agent row', async () => {
    const { result } = renderHook(() => useSwitchModelDisplayScope());
    await act(async () => {
      expect(await result.current('agent')).toBe(true);
    });
    expect(state.savedTopic).toEqual({ model: 'professional', provider: 'test' });
    expect(state.selectModel).not.toHaveBeenCalled();
  });
  it('keeps an existing model that is valid in the target pool', async () => {
    state.topicModel = { model: 'other-agent-model', provider: 'test' };
    const { result } = renderHook(() => useSwitchModelDisplayScope());
    await act(async () => {
      expect(await result.current('agent')).toBe(true);
    });
    expect(state.updateTopicModel).not.toHaveBeenCalled();
  });
  it('does not report success using the Agent default while the topic is still loading', async () => {
    state.loading = true;
    const { result } = renderHook(() => useSwitchModelDisplayScope());
    await act(async () => {
      expect(await result.current('agent')).toBe(false);
    });
    expect(state.updateTopicModel).not.toHaveBeenCalled();
  });
  it('does not modify the previous topic from the home composer', async () => {
    state.scope = false;
    const { result } = renderHook(() => useSwitchModelDisplayScope());
    await act(async () => {
      expect(await result.current('chat')).toBe(true);
    });
    expect(state.updateTopicModel).not.toHaveBeenCalled();
    expect(state.selectModel).toHaveBeenCalledWith({ model: 'fast', provider: 'test' });
  });
});
