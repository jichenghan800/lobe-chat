import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KnowledgeType } from '@/types/knowledgeBase';

import Actions from './Action';

const mocks = vi.hoisted(() => ({
  addFilesToAgent: vi.fn(),
  addKnowledgeBaseToAgent: vi.fn(),
  attachResourceSpreadsheetFilesToChat: vi.fn(),
  removeFileFromAgent: vi.fn(),
  removeKnowledgeBaseFromAgent: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@lobehub/ui', () => {
  return {
    ActionIcon: ({ loading }: { loading?: boolean }) => (
      <button data-loading={loading} type="button">
        menu
      </button>
    ),
    Button: ({
      children,
      loading,
      onClick,
    }: {
      children: ReactNode;
      loading?: boolean;
      onClick?: () => void;
    }) => (
      <button data-loading={loading} type="button" onClick={onClick}>
        {children}
      </button>
    ),
    DropdownMenu: ({ children }: { children: ReactNode }) => (
      <div data-testid="dropdown-menu">{children}</div>
    ),
    Flexbox: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Icon: () => <span />,
  };
});

vi.mock('@/store/agent', () => ({
  useAgentStore: (selector: (state: unknown) => unknown) =>
    selector({
      addFilesToAgent: mocks.addFilesToAgent,
      addKnowledgeBaseToAgent: mocks.addKnowledgeBaseToAgent,
      removeFileFromAgent: mocks.removeFileFromAgent,
      removeKnowledgeBaseFromAgent: mocks.removeKnowledgeBaseFromAgent,
    }),
}));

vi.mock('@/store/file', () => ({
  useFileStore: (selector: (state: unknown) => unknown) =>
    selector({
      attachResourceSpreadsheetFilesToChat: mocks.attachResourceSpreadsheetFilesToChat,
    }),
}));

vi.mock('@/store/serverConfig', () => ({
  useServerConfigStore: (selector: (state: unknown) => unknown) => selector({ isMobile: false }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.addFilesToAgent.mockResolvedValue(undefined);
  mocks.addKnowledgeBaseToAgent.mockResolvedValue(undefined);
  mocks.attachResourceSpreadsheetFilesToChat.mockResolvedValue(1);
  mocks.removeFileFromAgent.mockResolvedValue(undefined);
  mocks.removeKnowledgeBaseFromAgent.mockResolvedValue(undefined);
});

describe('AssignKnowledgeBase Actions', () => {
  it('attaches spreadsheet files to the current chat input instead of agent knowledge', async () => {
    render(
      <Actions
        fileType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        id="file-xlsx"
        name="大宗差旅.xlsx"
        type={KnowledgeType.File}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'FileManager.actions.attachSpreadsheetToAgent' }),
    );

    await waitFor(() => {
      expect(mocks.attachResourceSpreadsheetFilesToChat).toHaveBeenCalledWith(['file-xlsx']);
    });
    expect(mocks.addFilesToAgent).not.toHaveBeenCalled();
  });

  it('removes a stale enabled spreadsheet relation before attaching it to the chat input', async () => {
    render(
      <Actions
        enabled
        fileType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        id="file-xlsx"
        name="大宗差旅.xlsx"
        type={KnowledgeType.File}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'FileManager.actions.attachSpreadsheetToAgent' }),
    );

    await waitFor(() => {
      expect(mocks.removeFileFromAgent).toHaveBeenCalledWith('file-xlsx');
      expect(mocks.attachResourceSpreadsheetFilesToChat).toHaveBeenCalledWith(['file-xlsx']);
    });
    expect(screen.queryByTestId('dropdown-menu')).not.toBeInTheDocument();
  });

  it('keeps non-spreadsheet files on the existing agent knowledge path', async () => {
    render(
      <Actions
        fileType="application/pdf"
        id="file-pdf"
        name="readme.pdf"
        type={KnowledgeType.File}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'knowledgeBase.library.action.add' }));

    await waitFor(() => {
      expect(mocks.addFilesToAgent).toHaveBeenCalledWith(['file-pdf'], true);
    });
    expect(mocks.attachResourceSpreadsheetFilesToChat).not.toHaveBeenCalled();
  });
});
