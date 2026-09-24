import { fireEvent, render, screen } from '@testing-library/react';
import type * as React from 'react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ModelSwitch from './index';

const mocks = vi.hoisted(() => ({
  scope: false,
  mode: 'chat' as 'chat' | 'agent',
  topicId: 'old-topic',
  loading: false,
  selectModel: vi.fn(),
  updateTopicModel: vi.fn(),
  effort: vi.fn(() => ({ hasReasoningParams: true, effortValue: 'low' })),
  sync: vi.fn(async () => true),
}));
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof React>()),
  memo: (component: unknown) => component,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@lobehub/ui', () => ({ Tooltip: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/features/ModelSwitchPanel', () => ({ default: () => null }));
vi.mock('../../store', () => ({
  useChatInputStore: (selector: (s: { topicModelScope: boolean }) => unknown) =>
    selector({ topicModelScope: mocks.scope }),
}));
vi.mock('@/store/chat', () => ({
  useChatStore: (
    selector: (s: {
      activeTopicId: string;
      updateTopicModel: typeof mocks.updateTopicModel;
    }) => unknown,
  ) => selector({ activeTopicId: mocks.topicId, updateTopicModel: mocks.updateTopicModel }),
}));
vi.mock('@/store/chat/slices/topic/selectors', () => ({
  topicSelectors: {
    activeTopicModel: () => ({ model: 'professional', provider: 'provider' }),
    isActiveTopicModelLoading: () => mocks.loading,
  },
}));
vi.mock('@/store/aiInfra', () => ({
  useAiInfraStore: (selector: () => unknown) => selector(),
  aiModelSelectors: { getEnabledModelById: (model: string) => () => ({ displayName: model }) },
}));
vi.mock('../../hooks/useAgentId', () => ({ useAgentId: () => 'agent' }));
vi.mock('../../hooks/useEffectiveAgentMode', () => ({
  useEffectiveAgentMode: () => ({ currentMode: mocks.mode }),
}));
vi.mock('../../hooks/useAgentModelSelection', () => ({
  useAgentModelSelection: () => ({
    canDisplayModel: true,
    canSelectModel: true,
    model: 'fast',
    provider: 'provider',
    selectModel: mocks.selectModel,
  }),
}));
vi.mock('../../hooks/useReasoningEffortControl', () => ({
  useReasoningEffortControl: mocks.effort,
}));
vi.mock('../../hooks/useModelLockTooltip', () => ({ useModelLockTooltip: () => '' }));
vi.mock('../../hooks/useSwitchModelDisplayScope', () => ({
  useSwitchModelDisplayScope: () => mocks.sync,
}));
vi.mock('../../components/SelectorTrigger', () => ({ default: () => null }));
vi.mock('./SelectorMenu', () => ({
  default: ({
    model,
    onModelChange,
  }: {
    model: string;
    onModelChange: (value: { model: string; provider: string }) => void;
  }) => (
    <button onClick={() => onModelChange({ model: 'chosen', provider: 'provider' })}>
      {model}
    </button>
  ),
}));

describe('model selection scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.scope = false;
    mocks.mode = 'chat';
    mocks.topicId = 'old-topic';
    mocks.sync = vi.fn(async () => true);
    mocks.loading = false;
  });
  it('home edits the new-conversation model and effort without modifying the previous topic', () => {
    render(<ModelSwitch />);
    fireEvent.click(screen.getByText('fast'));
    expect(mocks.selectModel).toHaveBeenCalledWith({ model: 'chosen', provider: 'provider' });
    expect(mocks.updateTopicModel).not.toHaveBeenCalled();
    expect(mocks.effort).toHaveBeenCalledWith('fast', 'provider', undefined);
  });
  it('home remains usable while the previous topic model is loading', () => {
    mocks.loading = true;
    render(<ModelSwitch />);
    expect(screen.getByText('fast')).toBeTruthy();
  });
  it('a conversation still edits its own model and reasoning pin', () => {
    mocks.scope = true;
    render(<ModelSwitch />);
    fireEvent.click(screen.getByText('professional'));
    expect(mocks.updateTopicModel).toHaveBeenCalledWith('old-topic', {
      model: 'chosen',
      provider: 'provider',
    });
    expect(mocks.selectModel).not.toHaveBeenCalled();
    expect(mocks.effort).toHaveBeenCalledWith('professional', 'provider', 'old-topic');
  });
  it('reconciles a topic against the inherited Agent mode without an explicit home scope', () => {
    mocks.scope = true;
    mocks.mode = 'agent';
    render(<ModelSwitch />);
    expect(mocks.sync).toHaveBeenCalledWith('agent');
  });

  it('does not undo the intermediate model write during a manual mode switch', () => {
    mocks.scope = true;
    const { rerender } = render(<ModelSwitch />);
    expect(mocks.sync).toHaveBeenCalledWith('chat');
    // Changing the model rebuilds the hook callback before the mode is saved.
    mocks.sync = vi.fn(async () => true);
    rerender(<ModelSwitch />);
    expect(mocks.sync).not.toHaveBeenCalled();
    mocks.mode = 'agent';
    rerender(<ModelSwitch />);
    expect(mocks.sync).toHaveBeenCalledWith('agent');
  });

  it('rechecks a different topic of the same Agent', () => {
    mocks.scope = true;
    mocks.mode = 'agent';
    const { rerender } = render(<ModelSwitch />);
    mocks.sync.mockClear();
    mocks.topicId = 'another-topic';
    rerender(<ModelSwitch />);
    expect(mocks.sync).toHaveBeenCalledWith('agent');
  });

  it('waits for the topic pin before reconciling', () => {
    mocks.scope = true;
    mocks.loading = true;
    const { rerender } = render(<ModelSwitch />);
    expect(mocks.sync).not.toHaveBeenCalled();
    mocks.loading = false;
    rerender(<ModelSwitch />);
    expect(mocks.sync).toHaveBeenCalledWith('chat');
  });
});
