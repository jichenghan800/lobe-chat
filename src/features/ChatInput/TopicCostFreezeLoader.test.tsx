import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TopicCostFreezeLoader } from './TopicCostFreezeLoader';

const state = vi.hoisted(() => ({
  activeAgentId: 'agent',
  activeTopicId: 'topic',
  data: undefined as unknown,
  setState: vi.fn(),
}));

vi.mock('@/services/topic', () => ({ topicService: { getCostFreeze: vi.fn() } }));
vi.mock('swr', () => ({ default: () => ({ data: state.data }) }));
vi.mock('@/store/chat', () => ({
  useChatStore: (selector: (value: typeof state) => unknown) => selector(state),
}));
vi.mock('./store', () => ({
  useStoreApi: () => api,
  useChatInputStore: (
    selector: (value: { agentId: string; topicModelScope: boolean }) => unknown,
  ) => selector({ agentId: 'agent', topicModelScope: true }),
}));
const api = { setState: state.setState };

describe('topic freeze presentation state', () => {
  beforeEach(() => {
    state.activeAgentId = 'agent';
    state.activeTopicId = 'topic';
    state.data = undefined;
    vi.clearAllMocks();
  });
  it('exposes the recorded reason and amounts alongside the send gate, then clears them', () => {
    const freeze = { reason: 'budget', spentCny: '9.12', limitFen: 1000 };
    state.data = freeze;
    const { rerender, unmount } = renderHook(() => TopicCostFreezeLoader());
    expect(state.setState).toHaveBeenLastCalledWith({ costFrozen: true, costFreeze: freeze });
    state.data = null;
    rerender();
    expect(state.setState).toHaveBeenLastCalledWith({ costFrozen: false, costFreeze: null });
    unmount();
    expect(state.setState).toHaveBeenLastCalledWith({ costFrozen: false, costFreeze: undefined });
  });
  it('does not show another agent scope’s cached freeze', () => {
    state.activeAgentId = 'other';
    state.data = { reason: 'manual' };
    renderHook(() => TopicCostFreezeLoader());
    expect(state.setState).toHaveBeenLastCalledWith({ costFrozen: false, costFreeze: undefined });
  });
});
