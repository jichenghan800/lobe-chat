import { toast } from '@lobehub/ui/base-ui';
import { act, renderHook } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { notification } from '@/components/AntdStaticMethods';
import { fileService } from '@/services/file';
import { ragService } from '@/services/rag';
import { agentByIdSelectors } from '@/store/agent/selectors';

import { useFileStore as useStore } from '../../store';
import { LARGE_EXCEL_UPLOAD_LIMIT_BYTES } from './uploadGuard';

const AGENT_ID = 'agent-1';

/** Force the conversation agent into chat / agent / heterogeneous mode for the by-id selectors. */
const mockAgentMode = ({
  enableAgentMode,
  heterogeneous,
}: {
  enableAgentMode: boolean;
  heterogeneous: boolean;
}) => {
  vi.spyOn(agentByIdSelectors, 'getAgentEnableModeById').mockReturnValue(() => enableAgentMode);
  vi.spyOn(agentByIdSelectors, 'isAgentHeterogeneousById').mockReturnValue(() => heterogeneous);
};

vi.mock('zustand/traditional');

vi.mock('@lobehub/ui/base-ui', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock necessary modules and functions
vi.mock('@/components/AntdStaticMethods', () => ({
  notification: {
    error: vi.fn(),
  },
}));

vi.mock('@/services/file', () => ({
  FileService: vi.fn().mockImplementation(() => ({
    getFolderBreadcrumb: vi.fn(),
    getKnowledgeItem: vi.fn(),
    getKnowledgeItems: vi.fn(),
  })),
  fileService: {
    getKnowledgeItem: vi.fn(),
    removeFile: vi.fn(),
  },
}));

vi.mock('@/services/rag', () => ({
  ragService: {
    parseFileContent: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('i18next', () => ({
  t: (key: string, options?: { reason?: string }) => {
    if (key === 'upload.permissionDenied') {
      return 'You do not have permission to upload files in this workspace.';
    }

    if (key === 'upload.uploadFailed') return 'File upload failed.';

    if (key === 'upload.unknownError') return `Error reason: ${options?.reason}`;

    return key;
  },
}));

beforeAll(() => {
  Object.defineProperty(File.prototype, 'arrayBuffer', {
    writable: true,
    value: function () {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result);
        };
        reader.readAsArrayBuffer(this);
      });
    },
  });
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('useFileStore:chat', () => {
  it('clearChatUploadFileList should clear the inputFilesList', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      useStore.setState({ chatUploadFileList: [{ id: 'abc' }] as any });
    });

    expect(result.current.chatUploadFileList).toEqual([{ id: 'abc' }]);

    act(() => {
      result.current.clearChatUploadFileList();
    });

    expect(result.current.chatUploadFileList).toEqual([]);
  });

  it('uploadChatFiles should reject unsupported files before upload in chat mode', async () => {
    // chat mode: agent mode disabled and not a heterogeneous agent
    mockAgentMode({ enableAgentMode: false, heterogeneous: false });

    const { result } = renderHook(() => useStore());
    const uploadWithProgress = vi.fn();

    act(() => {
      useStore.setState({
        chatUploadFileList: [],
        uploadWithProgress: uploadWithProgress as any,
      });
    });

    await act(async () => {
      await result.current.uploadChatFiles(
        [
          new File(['<svg />'], 'icon.svg', { type: 'image/svg+xml' }),
          new File(['zip'], 'archive.zip', { type: 'application/zip' }),
        ],
        AGENT_ID,
      );
    });

    expect(uploadWithProgress).not.toHaveBeenCalled();
    expect(result.current.chatUploadFileList).toEqual([]);
    expect(toast.error).toHaveBeenCalledWith(expect.any(String));
  });

  it('uploadChatFiles should allow any file type in agent mode', async () => {
    mockAgentMode({ enableAgentMode: true, heterogeneous: false });

    const { result } = renderHook(() => useStore());
    const uploadWithProgress = vi.fn().mockResolvedValue({ id: 'file-1', url: 'http://x/1' });

    act(() => {
      useStore.setState({
        chatUploadFileList: [],
        uploadWithProgress: uploadWithProgress as any,
      });
    });

    await act(async () => {
      await result.current.uploadChatFiles(
        [new File(['zip'], 'archive.zip', { type: 'application/zip' })],
        AGENT_ID,
      );
    });

    expect(toast.error).not.toHaveBeenCalled();
    expect(uploadWithProgress).toHaveBeenCalledTimes(1);
    expect(ragService.parseFileContent).not.toHaveBeenCalled();
  });

  it('uploadChatFiles should reject large Excel files before upload in chat mode', async () => {
    mockAgentMode({ enableAgentMode: false, heterogeneous: false });

    const { result } = renderHook(() => useStore());
    const uploadWithProgress = vi.fn();
    const largeExcel = new File(
      [new Uint8Array(LARGE_EXCEL_UPLOAD_LIMIT_BYTES + 1)],
      'large.xlsx',
      {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    );

    act(() => {
      useStore.setState({
        chatUploadFileList: [],
        uploadWithProgress: uploadWithProgress as any,
      });
    });

    await act(async () => {
      await result.current.uploadChatFiles([largeExcel], AGENT_ID);
    });

    expect(uploadWithProgress).not.toHaveBeenCalled();
    expect(result.current.chatUploadFileList).toEqual([]);
    expect(toast.error).toHaveBeenCalledWith('upload.validation.largeExcelFileInChat');
  });

  it('uploadChatFiles should allow large Excel files in agent mode', async () => {
    mockAgentMode({ enableAgentMode: true, heterogeneous: false });

    const { result } = renderHook(() => useStore());
    const uploadWithProgress = vi.fn().mockResolvedValue({ id: 'file-excel', url: 'http://x/3' });
    const largeExcel = new File(
      [new Uint8Array(LARGE_EXCEL_UPLOAD_LIMIT_BYTES + 1)],
      'large.xlsx',
      {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    );

    act(() => {
      useStore.setState({
        chatUploadFileList: [],
        uploadWithProgress: uploadWithProgress as any,
      });
    });

    await act(async () => {
      await result.current.uploadChatFiles([largeExcel], AGENT_ID);
    });

    expect(toast.error).not.toHaveBeenCalled();
    expect(uploadWithProgress).toHaveBeenCalledTimes(1);
    expect(ragService.parseFileContent).not.toHaveBeenCalled();
  });

  it('uploadChatFiles should allow any file type for heterogeneous agents', async () => {
    mockAgentMode({ enableAgentMode: false, heterogeneous: true });

    const { result } = renderHook(() => useStore());
    const uploadWithProgress = vi.fn().mockResolvedValue({ id: 'file-2', url: 'http://x/2' });

    act(() => {
      useStore.setState({
        chatUploadFileList: [],
        uploadWithProgress: uploadWithProgress as any,
      });
    });

    await act(async () => {
      await result.current.uploadChatFiles(
        [new File(['profile'], 'Communication_Notifications.provisionprofile')],
        AGENT_ID,
      );
    });

    expect(toast.error).not.toHaveBeenCalled();
    expect(uploadWithProgress).toHaveBeenCalledTimes(1);
    expect(ragService.parseFileContent).not.toHaveBeenCalled();
  });

  it('shows a permission denied description when upload is rejected by RBAC', async () => {
    mockAgentMode({ enableAgentMode: false, heterogeneous: false });

    const { result } = renderHook(() => useStore());
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });

    vi.spyOn(result.current, 'uploadWithProgress').mockRejectedValue({
      data: { code: 'FORBIDDEN' },
      message: 'Missing any of: file:upload:all, file:upload:owner',
    });

    await act(async () => {
      await result.current.uploadChatFiles([file], AGENT_ID);
    });

    expect(notification.error).toHaveBeenCalledWith({
      description: 'You do not have permission to upload files in this workspace.',
      message: 'File upload failed.',
    });
  });

  it('attaches resource spreadsheets to chat without parsing or re-uploading', async () => {
    const { result } = renderHook(() => useStore());

    vi.mocked(fileService.getKnowledgeItem).mockImplementation(async (id) => {
      if (id === 'file-xlsx') {
        return {
          chunkCount: null,
          chunkingError: null,
          embeddingError: null,
          fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          finishEmbedding: false,
          id,
          name: 'report.xlsx',
          size: 1024,
          sourceType: 'file',
          url: 'https://files.example.com/report.xlsx',
        } as any;
      }

      return {
        chunkCount: null,
        chunkingError: null,
        embeddingError: null,
        fileType: 'application/pdf',
        finishEmbedding: false,
        id,
        name: 'readme.pdf',
        size: 1024,
        sourceType: 'file',
        url: 'https://files.example.com/readme.pdf',
      } as any;
    });

    await act(async () => {
      const count = await result.current.attachResourceSpreadsheetFilesToChat([
        'file-xlsx',
        'file-pdf',
      ]);
      expect(count).toBe(1);
    });

    expect(result.current.chatUploadFileList).toHaveLength(1);
    expect(result.current.chatUploadFileList[0]).toMatchObject({
      fileUrl: 'https://files.example.com/report.xlsx',
      id: 'file-xlsx',
      preserveServerFileOnRemove: true,
      status: 'success',
    });
    expect(result.current.chatUploadFileList[0].file.name).toBe('report.xlsx');
    expect(ragService.parseFileContent).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
  });

  it('does not delete the source resource when removing an attached resource spreadsheet', async () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      useStore.setState({
        chatUploadFileList: [
          {
            file: new File([], 'report.xlsx', {
              type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            }),
            id: 'file-xlsx',
            preserveServerFileOnRemove: true,
            status: 'success',
          },
        ] as any,
      });
    });

    await act(async () => {
      await result.current.removeChatUploadFile('file-xlsx');
    });

    expect(result.current.chatUploadFileList).toEqual([]);
    expect(fileService.removeFile).not.toHaveBeenCalled();
  });
});
