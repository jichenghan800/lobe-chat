import { act, render, waitFor } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HomeEditorInput from './EditorInput';

const mocks = vi.hoisted(() => ({
  providerProps: undefined as Record<string, unknown> | undefined,
  send: vi.fn(),
  toggleAgentMode: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/features/ChatInput', () => ({
  ChatInputProvider: ({ children, ...props }: { children: ReactNode }) => {
    mocks.providerProps = props;
    return children;
  },
  DesktopChatInput: () => <div data-testid="desktop-chat-input" />,
}));

vi.mock('@/features/ChatInput/hooks/useEffectiveAgentMode', () => ({
  useEffectiveAgentMode: () => ({
    isPreferenceLoading: false,
    requestedAgentModeEnabled: true,
  }),
}));

vi.mock('@/features/ChatInput/hooks/useToggleAgentMode', () => ({
  useToggleAgentMode: () => mocks.toggleAgentMode,
}));

vi.mock('@/store/chat', () => ({
  useChatStore: Object.assign(vi.fn(), { setState: vi.fn() }),
}));

describe('HomeEditorInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.providerProps = undefined;
  });

  it('isolates Home Chat from the active topic and normalizes a retained Agent mode', async () => {
    const props = {
      agentId: 'agent-1',
      initialValue: '',
      isAgentConfigLoading: false,
      loading: false,
      mode: 'chat' as const,
      onModeChange: vi.fn(),
      onValueChange: vi.fn(),
      send: mocks.send,
    } satisfies ComponentProps<typeof HomeEditorInput>;

    render(<HomeEditorInput {...props} />);

    expect(mocks.providerProps).toMatchObject({
      modelDisplayScope: 'chat',
      topicModelScope: false,
    });
    await waitFor(() => expect(mocks.toggleAgentMode).toHaveBeenCalledWith(false));

    const providerSend = mocks.providerProps?.onSend as (
      params: Record<string, unknown>,
    ) => Promise<void>;
    expect(providerSend).toBeTypeOf('function');

    mocks.toggleAgentMode.mockClear();
    const sendParams = {};
    await act(async () => providerSend(sendParams));

    expect(mocks.toggleAgentMode).toHaveBeenCalledWith(false);
    expect(mocks.send).toHaveBeenCalledWith(sendParams);
  });
});
