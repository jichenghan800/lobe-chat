import { act, render, waitFor } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HomeEditorInput from './EditorInput';

const mocks = vi.hoisted(() => ({
  providerProps: undefined as Record<string, unknown> | undefined,
  requestedAgentModeEnabled: true,
  send: vi.fn(),
  switchModelDisplayScope: vi.fn().mockResolvedValue(true),
  toggleAgentMode: vi.fn().mockResolvedValue(true),
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
    requestedAgentModeEnabled: mocks.requestedAgentModeEnabled,
  }),
}));

vi.mock('@/features/ChatInput/hooks/useSwitchModelDisplayScope', () => ({
  useSwitchModelDisplayScope: () => mocks.switchModelDisplayScope,
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
    mocks.requestedAgentModeEnabled = true;
    mocks.switchModelDisplayScope.mockResolvedValue(true);
    mocks.toggleAgentMode.mockResolvedValue(true);
  });

  it('isolates Home Chat from the active topic and normalizes a retained Agent mode', async () => {
    const props = {
      agentId: 'agent-1',
      contextSelectionKey: 'home:test',
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

  it('switches to Agent before sending and exposes the Agent model scope', async () => {
    mocks.requestedAgentModeEnabled = false;
    const props = {
      agentId: 'agent-1',
      contextSelectionKey: 'home:test',
      initialValue: '',
      isAgentConfigLoading: false,
      loading: false,
      mode: 'agent' as const,
      onModeChange: vi.fn(),
      onValueChange: vi.fn(),
      send: mocks.send,
    } satisfies ComponentProps<typeof HomeEditorInput>;

    render(<HomeEditorInput {...props} />);

    expect(mocks.providerProps).toMatchObject({
      modelDisplayScope: 'agent',
      topicModelScope: false,
    });
    await waitFor(() => expect(mocks.toggleAgentMode).toHaveBeenCalledWith(true));

    mocks.toggleAgentMode.mockClear();
    const providerSend = mocks.providerProps?.onSend as (
      params: Record<string, unknown>,
    ) => Promise<void>;
    await act(async () => providerSend({ message: 'analyze' }));

    expect(mocks.toggleAgentMode).toHaveBeenCalledWith(true);
    expect(mocks.send).toHaveBeenCalledWith({ message: 'analyze' });
    expect(mocks.toggleAgentMode.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.send.mock.invocationCallOrder[0],
    );
  });

  it('keeps the draft on Home when Agent mode cannot be applied', async () => {
    mocks.requestedAgentModeEnabled = false;
    mocks.toggleAgentMode.mockResolvedValue(false);
    const props = {
      agentId: 'agent-1',
      contextSelectionKey: 'home:test',
      initialValue: '',
      isAgentConfigLoading: false,
      loading: false,
      mode: 'agent' as const,
      onModeChange: vi.fn(),
      onValueChange: vi.fn(),
      send: mocks.send,
    } satisfies ComponentProps<typeof HomeEditorInput>;

    render(<HomeEditorInput {...props} />);
    const providerSend = mocks.providerProps?.onSend as (
      params: Record<string, unknown>,
    ) => Promise<void>;
    await act(async () => providerSend({ message: 'analyze' }));

    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('uses the Agent model pool for Task and resolves it before sending', async () => {
    const props = {
      agentId: 'agent-1',
      contextSelectionKey: 'home:test',
      initialValue: '',
      isAgentConfigLoading: false,
      loading: false,
      mode: 'task' as const,
      onModeChange: vi.fn(),
      onValueChange: vi.fn(),
      send: mocks.send,
    } satisfies ComponentProps<typeof HomeEditorInput>;

    render(<HomeEditorInput {...props} />);

    expect(mocks.providerProps).toMatchObject({
      modelDisplayScope: 'agent',
      topicModelScope: false,
    });
    await waitFor(() => expect(mocks.switchModelDisplayScope).toHaveBeenCalledWith('agent'));

    mocks.switchModelDisplayScope.mockClear();
    const providerSend = mocks.providerProps?.onSend as (
      params: Record<string, unknown>,
    ) => Promise<void>;
    await act(async () => providerSend({ message: 'run task' }));

    expect(mocks.switchModelDisplayScope).toHaveBeenCalledWith('agent');
    expect(mocks.toggleAgentMode).not.toHaveBeenCalled();
    expect(mocks.send).toHaveBeenCalledWith({ message: 'run task' });
    expect(mocks.switchModelDisplayScope.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.send.mock.invocationCallOrder[0],
    );
  });

  it('restores the Chat model pool after leaving Task', async () => {
    mocks.requestedAgentModeEnabled = false;
    const props = {
      agentId: 'agent-1',
      contextSelectionKey: 'home:test',
      initialValue: '',
      isAgentConfigLoading: false,
      loading: false,
      mode: 'task' as const,
      onModeChange: vi.fn(),
      onValueChange: vi.fn(),
      send: mocks.send,
    } satisfies ComponentProps<typeof HomeEditorInput>;
    const { rerender } = render(<HomeEditorInput {...props} />);
    await waitFor(() => expect(mocks.switchModelDisplayScope).toHaveBeenCalledWith('agent'));

    mocks.switchModelDisplayScope.mockClear();
    rerender(<HomeEditorInput {...props} mode={'chat'} />);

    await waitFor(() => expect(mocks.switchModelDisplayScope).toHaveBeenCalledWith('chat'));
    expect(mocks.providerProps).toMatchObject({ modelDisplayScope: 'chat' });
  });

  it('keeps the Task draft when the Agent model pool cannot be applied', async () => {
    mocks.switchModelDisplayScope.mockResolvedValue(false);
    const props = {
      agentId: 'agent-1',
      contextSelectionKey: 'home:test',
      initialValue: '',
      isAgentConfigLoading: false,
      loading: false,
      mode: 'task' as const,
      onModeChange: vi.fn(),
      onValueChange: vi.fn(),
      send: mocks.send,
    } satisfies ComponentProps<typeof HomeEditorInput>;

    render(<HomeEditorInput {...props} />);
    const providerSend = mocks.providerProps?.onSend as (
      params: Record<string, unknown>,
    ) => Promise<void>;
    await act(async () => providerSend({ message: 'run task' }));

    expect(mocks.send).not.toHaveBeenCalled();
  });
});
