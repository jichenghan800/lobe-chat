/**
 * @vitest-environment happy-dom
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useGlobalStore } from '@/store/global';

import TaskWorkspaceLayout from './TaskWorkspaceLayout';

const mocks = vi.hoisted(() => ({
  isMobile: false,
}));

vi.mock('react-router', async () => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = (await vi.importActual('react-router')) as typeof import('react-router');

  return {
    ...actual,
    Outlet: () => <div data-testid="task-workspace-outlet">outlet</div>,
  };
});

vi.mock('@/features/AgentTaskManager/TaskAgentProvider', () => ({
  TaskAgentProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="task-agent-provider">{children}</div>
  ),
}));
vi.mock('@/features/AgentTaskManager/Conversation', () => ({
  default: () => <div data-testid="task-conversation" />,
}));
vi.mock('@/features/Portal/router', () => ({
  PortalContent: () => <div data-testid="task-acceptance" />,
}));

vi.mock('@/features/Portal/Mobile', () => ({
  default: () => <div data-testid="mobile-task-portal" />,
}));
vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: () => mocks.isMobile,
}));

const setPanelExpanded = (showTaskAgentPanel: boolean) => {
  act(() => {
    useGlobalStore.setState((state) => ({
      status: { ...state.status, showTaskAgentPanel },
    }));
  });
};

describe('TaskWorkspaceLayout', () => {
  afterEach(cleanup);
  beforeEach(() => {
    mocks.isMobile = false;
    setPanelExpanded(false);
  });

  it('renders the task workspace without mutating global NavPanel state', () => {
    render(<TaskWorkspaceLayout />);

    expect(screen.getByTestId('task-workspace-outlet')).toBeInTheDocument();
    expect(screen.queryByTestId('task-agent-provider')).not.toBeInTheDocument();
    expect(screen.queryByTestId('task-conversation')).not.toBeInTheDocument();
  });

  it('mounts on first expansion and preserves the same conversation on collapse and reopen', () => {
    render(<TaskWorkspaceLayout />);
    expect(screen.queryByTestId('task-conversation')).not.toBeInTheDocument();
    setPanelExpanded(true);
    const conversation = screen.getByTestId('task-conversation');
    const provider = screen.getByTestId('task-agent-provider');
    setPanelExpanded(false);
    expect(screen.getByTestId('task-conversation')).toBe(conversation);
    expect(screen.getByTestId('task-agent-provider')).toBe(provider);
    setPanelExpanded(true);
    expect(screen.getByTestId('task-conversation')).toBe(conversation);
  });

  it('mounts immediately when the panel was already expanded', () => {
    setPanelExpanded(true);
    render(<TaskWorkspaceLayout />);
    expect(screen.getByTestId('task-conversation')).toBeInTheDocument();
  });

  it('mounts the Portal surface instead of the desktop task manager on mobile', () => {
    mocks.isMobile = true;

    render(<TaskWorkspaceLayout />);

    expect(screen.getByTestId('mobile-task-portal')).toBeInTheDocument();
    expect(screen.queryByTestId('task-agent-provider')).not.toBeInTheDocument();
  });
});
