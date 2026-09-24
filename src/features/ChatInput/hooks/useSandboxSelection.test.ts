import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getPendingSandboxProvider,
  setPendingSandboxProvider,
} from '@/store/chat/pendingSandboxProvider';

import { useSandboxSelection } from './useSandboxSelection';

const state = vi.hoisted(() => ({
  topicModelScope: true,
  activeAgentId: 'agent',
  activeTopicId: 'old-topic' as string | undefined,
  metadata: { sandboxProvider: 'market' },
  switchTopic: vi.fn(),
  refreshTopic: vi.fn(),
  switchUnusedTopic: vi.fn(),
  running: false,
  confirm: vi.fn(),
  error: vi.fn(),
}));
vi.mock('@/features/ChatInput/store', () => ({
  useChatInputStore: (selector: (s: typeof state) => unknown) => selector(state),
}));
vi.mock('@/store/chat', () => ({
  useChatStore: (selector: (s: typeof state) => unknown) => selector(state),
}));
vi.mock('@/store/chat/selectors', () => ({
  operationSelectors: { isTopicVisiblyRunning: () => (s: typeof state) => s.running },
  topicSelectors: { currentTopicMetadata: (s: typeof state) => s.metadata },
}));
vi.mock('@/libs/swr', () => ({
  useClientDataSWR: () => ({ data: { selfHostedAvailable: true } }),
}));
vi.mock('@/services/cottiSandbox', () => ({
  cottiSandboxService: { getAvailability: vi.fn(), switchUnusedTopic: state.switchUnusedTopic },
}));
vi.mock('@lobehub/ui/base-ui', () => ({
  confirmModal: state.confirm,
  toast: { error: state.error },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('sandbox selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.running = false;
    state.switchUnusedTopic.mockResolvedValue({ status: 'new_topic_required' });
    state.refreshTopic.mockResolvedValue(undefined);
    state.topicModelScope = true;
    state.activeAgentId = 'agent';
    state.activeTopicId = 'old-topic';
    state.switchTopic.mockResolvedValue(undefined);
    setPendingSandboxProvider('agent', 'market');
  });

  it('does not bind home selection to the previous conversation', async () => {
    state.topicModelScope = false;
    const { result } = renderHook(() => useSandboxSelection('agent', async () => true));
    await act(async () => {
      result.current.select('onlyboxes');
    });
    expect(result.current.provider).toBe('onlyboxes');
    expect(state.confirm).not.toHaveBeenCalled();
    expect(state.switchTopic).not.toHaveBeenCalled();
  });

  it('requires a new topic before changing an existing cloud topic', async () => {
    const { result } = renderHook(() => useSandboxSelection('agent', async () => true));
    await act(async () => {
      await result.current.select('onlyboxes');
    });
    expect(getPendingSandboxProvider('agent')).toBe('market');
    expect(state.switchTopic).not.toHaveBeenCalled();
    await act(async () => {
      await state.confirm.mock.calls[0][0].onOk();
    });
    expect(state.switchTopic).toHaveBeenCalledWith(null);
    expect(getPendingSandboxProvider('agent')).toBe('onlyboxes');
  });

  it('does not change the sandbox after execution target save fails', async () => {
    state.activeTopicId = undefined;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useSandboxSelection('agent', async () => false));
    await act(async () => {
      result.current.select('onlyboxes');
    });
    expect(getPendingSandboxProvider('agent')).toBe('market');
    expect(state.error).toHaveBeenCalledOnce();
  });
});

it('keeps the existing topic after a permitted switch', async () => {
  state.running = false;
  state.activeTopicId = 'old-topic';
  state.switchUnusedTopic.mockResolvedValue({ status: 'switched' });
  state.confirm.mockClear();
  state.switchTopic.mockClear();
  const { result } = renderHook(() => useSandboxSelection('agent', async () => true));
  await act(async () => {
    await result.current.select('onlyboxes');
  });
  expect(state.refreshTopic).toHaveBeenCalled();
  expect(state.confirm).not.toHaveBeenCalled();
  expect(state.switchTopic).not.toHaveBeenCalled();
});
it('blocks switching during a locally running turn', async () => {
  state.running = true;
  state.switchUnusedTopic.mockClear();
  const enable = vi.fn(async () => true);
  const { result } = renderHook(() => useSandboxSelection('agent', enable));
  await act(async () => {
    await result.current.select('onlyboxes');
  });
  expect(enable).not.toHaveBeenCalled();
  expect(state.switchUnusedTopic).not.toHaveBeenCalled();
});
