import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTopicContinuation } from './useTopicContinuation';

const mocks = vi.hoisted(() => ({
  activeTopicId: 'source' as string | null,
  createMessage: vi.fn(),
  createTopic: vi.fn(),
  draft: { text: 'unsent question' },
  fetch: vi.fn(),
  generating: false,
  refresh: vi.fn(),
  remove: vi.fn(),
  saveDraft: vi.fn(),
  switchTopic: vi.fn(),
  transcript: vi.fn(),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => `${key}:${JSON.stringify(values ?? {})}`,
  }),
}));
vi.mock('@/services/chat', () => ({ chatService: { fetchPresetTaskResult: mocks.fetch } }));
vi.mock('@/services/message', () => ({ messageService: { createMessage: mocks.createMessage } }));
vi.mock('@/services/topic', () => ({
  topicService: {
    createTopic: mocks.createTopic,
    removeTopic: mocks.remove,
    getTopicTranscript: mocks.transcript,
  },
}));
vi.mock('@/store/agent', () => ({ useAgentStore: { getState: () => ({}) } }));
vi.mock('@/store/agent/selectors', () => ({
  agentSelectors: { getAgentConfigById: () => () => ({ model: 'terra', provider: 'azure' }) },
}));
vi.mock('@/store/chat', () => ({
  useChatStore: {
    getState: () => ({
      activeTopicId: mocks.activeTopicId,
      refreshTopic: mocks.refresh,
      switchTopic: mocks.switchTopic,
    }),
  },
}));
vi.mock('@/store/chat/selectors', () => ({
  topicSelectors: { getTopicById: () => () => ({ title: 'daily work' }) },
}));
vi.mock('../../draftStorage', () => ({ saveDraft: mocks.saveDraft }));
vi.mock('../../store', () => ({
  useStoreApi: () => ({
    getState: () => ({
      getJSONState: () => mocks.draft,
      getMarkdownContent: () => mocks.draft.text,
      sendButtonProps: { generating: mocks.generating },
    }),
  }),
}));

describe('new question and progress continuation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.activeTopicId = 'source';
    mocks.generating = false;
    mocks.draft = { text: 'unsent question' };
    mocks.refresh.mockResolvedValue(undefined);
    mocks.createTopic.mockResolvedValue('new');
    mocks.saveDraft.mockReturnValue(1);
    mocks.transcript.mockResolvedValue({
      items: [
        {
          id: 'm',
          role: 'user',
          content: 'confirmed budget 123',
          createdAt: new Date(),
          threadId: null,
        },
      ],
      total: 1,
    });
    mocks.fetch.mockImplementation(async ({ onFinish }) => {
      await onFinish('Keep budget 123. Next: finish report.');
    });
  });
  it('starts a clean topic, preserving the latest draft without calling a model', async () => {
    const navigate = vi.fn();
    const { result } = renderHook(() => useTopicContinuation('agent', navigate));
    await act(async () => {
      await result.current.open(false);
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.createTopic).toHaveBeenCalledWith(expect.objectContaining({ agentId: 'agent' }));
    expect(mocks.createTopic.mock.calls[0][0]).not.toHaveProperty('sessionId');
    expect(mocks.createMessage).not.toHaveBeenCalled();
    expect(mocks.saveDraft).toHaveBeenCalledWith('main_agent_new', mocks.draft);
    expect(navigate).toHaveBeenCalledWith('/agent/agent/new');
  });
  it('carries a summary and source link without copying the original transcript', async () => {
    const { result } = renderHook(() => useTopicContinuation('agent', vi.fn()));
    await act(async () => {
      await result.current.open(true);
    });
    expect(mocks.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        topicId: 'new',
        content: expect.stringContaining('Keep budget 123'),
      }),
    );
    expect(mocks.createMessage.mock.calls[0][0].content).toContain('/agent/agent/source');
    expect(mocks.createMessage.mock.calls[0][0].content).not.toContain('confirmed budget 123');
  });
  it('a failed summary leaves the source and draft intact', async () => {
    mocks.fetch.mockImplementation(async ({ onError }) => {
      onError(new Error('network failed'));
    });
    const { result } = renderHook(() => useTopicContinuation('agent', vi.fn()));
    await act(async () => {
      await expect(result.current.open(true)).rejects.toThrow('network failed');
    });
    expect(mocks.createTopic).not.toHaveBeenCalled();
    expect(mocks.switchTopic).not.toHaveBeenCalled();
    expect(result.current.busy).toBe(false);
  });
  it('does not switch away after the user changes conversations during summarization', async () => {
    mocks.fetch.mockImplementation(async ({ onFinish }) => {
      mocks.activeTopicId = 'other';
      await onFinish('summary');
    });
    const navigate = vi.fn();
    const { result } = renderHook(() => useTopicContinuation('agent', navigate));
    await act(async () => {
      await expect(result.current.open(true)).rejects.toThrow('Conversation changed');
    });
    expect(mocks.createTopic).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
  it('does not navigate if the user switches topics while refreshing the topic list', async () => {
    mocks.refresh.mockImplementation(async () => {
      mocks.activeTopicId = 'other';
    });
    const navigate = vi.fn();
    const { result } = renderHook(() => useTopicContinuation('agent', navigate));
    await act(async () => {
      await expect(result.current.open(false)).rejects.toThrow('Conversation changed');
    });
    expect(mocks.switchTopic).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it('rolls back only its new topic if draft persistence fails', async () => {
    mocks.saveDraft.mockReturnValue(undefined);
    const { result } = renderHook(() => useTopicContinuation('agent', vi.fn()));
    await act(async () => {
      await expect(result.current.open(false)).rejects.toThrow('preserve draft');
    });
    expect(mocks.remove).toHaveBeenCalledWith('new');
    expect(mocks.switchTopic).not.toHaveBeenCalled();
  });
});
