import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useControls } from './useControls';

const mocks = vi.hoisted(() => ({
  attachResourceSpreadsheetFilesToChat: vi.fn(),
  chatUploadFileList: [] as any[],
  files: [] as any[],
  knowledgeBases: [] as any[],
  removeChatUploadFile: vi.fn(),
  toggleFile: vi.fn(),
  toggleKnowledgeBase: vi.fn(),
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    viewMore: 'viewMore',
    viewMoreLabel: 'viewMoreLabel',
  }),
  cssVar: {
    colorFillTertiary: 'transparent',
    colorText: '#000',
    motionEaseOut: 'ease',
  },
  cx: (...classes: string[]) => classes.filter(Boolean).join(' '),
}));

vi.mock('@lobehub/ui', () => ({
  Icon: () => <span />,
}));

vi.mock('@/components/FileIcon', () => ({
  default: () => <span />,
}));

vi.mock('@/components/LibIcon', () => ({
  default: () => <span />,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/store/agent/selectors', () => ({
  agentByIdSelectors: {
    getAgentFilesById: () => () => mocks.files,
    getAgentKnowledgeBasesById: () => () => mocks.knowledgeBases,
  },
}));

vi.mock('@/store/agent', () => ({
  useAgentStore: (selector: (state: unknown) => unknown) =>
    selector({
      toggleFile: mocks.toggleFile,
      toggleKnowledgeBase: mocks.toggleKnowledgeBase,
    }),
}));

vi.mock('@/store/file', () => ({
  useFileStore: (selector: (state: unknown) => unknown) =>
    selector({
      attachResourceSpreadsheetFilesToChat: mocks.attachResourceSpreadsheetFilesToChat,
      chatUploadFileList: mocks.chatUploadFileList,
      removeChatUploadFile: mocks.removeChatUploadFile,
    }),
}));

vi.mock('../../hooks/useAgentId', () => ({
  useAgentId: () => 'agent-1',
}));

vi.mock('../components/CheckboxWithLoading', () => ({
  default: ({
    checked,
    id,
    label,
    onUpdate,
  }: {
    checked?: boolean;
    id: string;
    label: string;
    onUpdate: (id: string, enabled: boolean) => Promise<void>;
  }) => (
    <button
      data-checked={String(Boolean(checked))}
      data-testid={`checkbox-${id}`}
      type="button"
      onClick={() => onUpdate(id, !checked)}
    >
      {label}
    </button>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.files = [];
  mocks.knowledgeBases = [];
  mocks.chatUploadFileList = [];
  mocks.attachResourceSpreadsheetFilesToChat.mockResolvedValue(1);
  mocks.removeChatUploadFile.mockResolvedValue(undefined);
  mocks.toggleFile.mockResolvedValue(undefined);
  mocks.toggleKnowledgeBase.mockResolvedValue(undefined);
});

const renderFileCheckbox = (id: string) => {
  const { result } = renderHook(() => useControls({ openAttachKnowledgeModal: vi.fn() }));
  const fileItem = result.current.items.find((item: any) => item?.key === id) as any;

  render(<>{fileItem.label}</>);
};

describe('ChatInput Knowledge useControls', () => {
  it('attaches spreadsheet resource files to the current chat input from the inline attachment menu', async () => {
    mocks.files = [
      {
        enabled: false,
        id: 'file-xlsx',
        name: '大宗差旅.xlsx',
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    ];

    renderFileCheckbox('file-xlsx');
    fireEvent.click(screen.getByTestId('checkbox-file-xlsx'));

    await waitFor(() => {
      expect(mocks.attachResourceSpreadsheetFilesToChat).toHaveBeenCalledWith(['file-xlsx']);
    });
    expect(mocks.toggleFile).not.toHaveBeenCalled();
  });

  it('removes stale agent file selection before attaching a spreadsheet resource to the input', async () => {
    mocks.files = [
      {
        enabled: true,
        id: 'file-xlsx',
        name: '大宗差旅.xlsx',
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    ];

    renderFileCheckbox('file-xlsx');
    fireEvent.click(screen.getByTestId('checkbox-file-xlsx'));

    await waitFor(() => {
      expect(mocks.toggleFile).toHaveBeenCalledWith('file-xlsx', false);
      expect(mocks.attachResourceSpreadsheetFilesToChat).toHaveBeenCalledWith(['file-xlsx']);
    });
  });

  it('removes an already attached spreadsheet resource from the current chat input when unchecked', async () => {
    mocks.files = [
      {
        enabled: false,
        id: 'file-xlsx',
        name: '大宗差旅.xlsx',
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    ];
    mocks.chatUploadFileList = [{ id: 'file-xlsx' }];

    renderFileCheckbox('file-xlsx');
    const checkbox = screen.getByTestId('checkbox-file-xlsx');

    expect(checkbox).toHaveAttribute('data-checked', 'true');
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(mocks.removeChatUploadFile).toHaveBeenCalledWith('file-xlsx');
    });
    expect(mocks.attachResourceSpreadsheetFilesToChat).not.toHaveBeenCalled();
  });

  it('keeps non-spreadsheet files on the existing agent file toggle path', async () => {
    mocks.files = [
      {
        enabled: false,
        id: 'file-pdf',
        name: 'readme.pdf',
        type: 'application/pdf',
      },
    ];

    renderFileCheckbox('file-pdf');
    fireEvent.click(screen.getByTestId('checkbox-file-pdf'));

    await waitFor(() => {
      expect(mocks.toggleFile).toHaveBeenCalledWith('file-pdf', true);
    });
    expect(mocks.attachResourceSpreadsheetFilesToChat).not.toHaveBeenCalled();
  });
});
