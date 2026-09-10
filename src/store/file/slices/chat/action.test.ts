import type { ChatContextContent } from '@lobechat/types';
import { toast } from '@lobehub/ui/base-ui';
import { act, renderHook } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('@lobehub/ui/base-ui', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import('~base-ui-stubs')).baseUiStubs,
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
  it('isolates context selections by conversation key', () => {
    const { result } = renderHook(() => useStore());
    const sharedIdSelectionA: ChatContextContent = {
      content: 'selection A',
      id: 'shared-selection',
      type: 'text',
    };
    const sharedIdSelectionB: ChatContextContent = {
      content: 'selection B',
      id: 'shared-selection',
      type: 'text',
    };

    act(() => {
      useStore.setState({ chatContextSelectionsByContext: {} });
      result.current.addChatContextSelection({
        contextKey: 'topic-a',
        selection: sharedIdSelectionA,
      });
      result.current.addChatContextSelection({
        contextKey: 'topic-b',
        selection: sharedIdSelectionB,
      });
    });

    expect(result.current.chatContextSelectionsByContext).toEqual({
      'topic-a': [sharedIdSelectionA],
      'topic-b': [sharedIdSelectionB],
    });

    act(() => {
      result.current.removeChatContextSelection({
        contextKey: 'topic-a',
        id: sharedIdSelectionA.id,
      });
    });

    expect(result.current.chatContextSelectionsByContext).toEqual({
      'topic-b': [sharedIdSelectionB],
    });

    act(() => {
      result.current.clearChatContextSelections('topic-b');
    });

    expect(result.current.chatContextSelectionsByContext).toEqual({});
  });

  it('moves context selections to a new conversation key without overwriting the target', () => {
    const { result } = renderHook(() => useStore());
    const sourceSelection: ChatContextContent = {
      content: 'source selection',
      id: 'shared-selection',
      type: 'text',
    };
    const targetSelection: ChatContextContent = {
      content: 'stale target selection',
      id: 'shared-selection',
      type: 'text',
    };
    const targetOnlySelection: ChatContextContent = {
      content: 'target only',
      id: 'target-only',
      type: 'text',
    };

    act(() => {
      useStore.setState({
        chatContextSelectionsByContext: {
          'topic-new': [sourceSelection],
          'topic-real': [targetSelection, targetOnlySelection],
        },
      });
      result.current.moveChatContextSelections('topic-new', 'topic-real');
    });

    expect(result.current.chatContextSelectionsByContext).toEqual({
      'topic-real': [sourceSelection, targetOnlySelection],
    });
  });

  it('restores submitted selections without overwriting context added while sending', () => {
    const { result } = renderHook(() => useStore());
    const submittedSelection: ChatContextContent = {
      content: 'submitted selection',
      id: 'submitted',
      type: 'text',
    };
    const newerSelection: ChatContextContent = {
      content: 'newer selection',
      id: 'newer',
      type: 'text',
    };

    act(() => {
      useStore.setState({
        chatContextSelectionsByContext: { topic: [newerSelection] },
      });
      result.current.restoreChatContextSelections('topic', [submittedSelection]);
    });

    expect(result.current.chatContextSelectionsByContext).toEqual({
      topic: [submittedSelection, newerSelection],
    });
  });

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

  it('notifies the picker only after the selected file is visible as a pending attachment', async () => {
    mockAgentMode({ enableAgentMode: false, heterogeneous: false });

    const { result } = renderHook(() => useStore());
    const order: string[] = [];
    const uploadWithProgress = vi.fn().mockImplementation(async () => {
      order.push('upload');
      return { id: 'file-1', url: 'http://x/1' };
    });
    const onPrepared = vi.fn(() => {
      order.push('prepared');
      expect(useStore.getState().chatUploadFileList).toEqual([
        expect.objectContaining({ id: 'notes.txt', status: 'pending' }),
      ]);
    });

    act(() => {
      useStore.setState({ chatUploadFileList: [], uploadWithProgress: uploadWithProgress as any });
    });

    await act(async () => {
      await result.current.uploadChatFiles(
        [new File(['notes'], 'notes.txt', { type: 'text/plain' })],
        AGENT_ID,
        { onPrepared },
      );
    });

    expect(onPrepared).toHaveBeenCalledOnce();
    expect(order).toEqual(['prepared', 'upload']);
  });

  it('keeps large Excel visible after upload but marks it as Agent-only in chat mode', async () => {
    mockAgentMode({ enableAgentMode: false, heterogeneous: false });

    const { result } = renderHook(() => useStore());
    const uploadWithProgress = vi.fn().mockResolvedValue({
      id: 'file-excel',
      url: 'https://files.example.com/large.xlsx',
    });
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

    expect(uploadWithProgress).toHaveBeenCalledOnce();
    expect(result.current.chatUploadFileList).toEqual([
      expect.objectContaining({
        requiresAgentMode: true,
      }),
    ]);
    expect(ragService.parseFileContent).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledWith('upload.validation.largeExcelFileInChat');
  });

  it('uploadChatFiles should allow large Excel files in agent mode without parsing them', async () => {
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
  });

  it('keeps a permission-denied upload in place with a retryable error', async () => {
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

    expect(result.current.chatUploadFileList).toEqual([
      expect.objectContaining({
        agentId: AGENT_ID,
        error: 'You do not have permission to upload files in this workspace.',
        id: 'test.txt',
        status: 'error',
      }),
    ]);
  });

  it('attaches existing resource files without re-uploading or deleting their source records', async () => {
    const { result } = renderHook(() => useStore());
    const getKnowledgeItem = vi.spyOn(fileService, 'getKnowledgeItem');
    const removeFile = vi.spyOn(fileService, 'removeFile').mockResolvedValue(undefined);

    getKnowledgeItem.mockImplementation(async (id) => {
      if (id === 'docs-parsed') {
        return {
          fileId: 'file-sheet',
          fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          id,
          name: 'report.xlsx',
          size: 2048,
          sourceType: 'document',
          url: 'https://files.example.com/report.xlsx',
        } as any;
      }

      return {
        fileType: 'application/pdf',
        id,
        name: 'guide.pdf',
        size: 1024,
        sourceType: 'file',
        url: 'https://files.example.com/guide.pdf',
      } as any;
    });

    await act(async () => {
      const count = await result.current.attachResourceFilesToChat([
        'docs-parsed',
        'file-pdf',
        'docs-parsed',
      ]);
      expect(count).toBe(2);
    });

    expect(result.current.chatUploadFileList).toEqual([
      expect.objectContaining({
        fileUrl: 'https://files.example.com/report.xlsx',
        id: 'file-sheet',
        requiresAgentMode: true,
        skipRemoveFile: true,
        status: 'success',
      }),
      expect.objectContaining({
        fileUrl: 'https://files.example.com/guide.pdf',
        id: 'file-pdf',
        skipRemoveFile: true,
        status: 'success',
      }),
    ]);

    await act(async () => {
      await result.current.removeChatUploadFile('file-sheet');
    });

    expect(removeFile).not.toHaveBeenCalled();
    expect(result.current.chatUploadFileList).toHaveLength(1);
  });

  describe('removeChatUploadFile', () => {
    it('deletes the underlying file for a normal uploaded item', async () => {
      const removeFile = vi.spyOn(fileService, 'removeFile').mockResolvedValue(undefined);
      const { result } = renderHook(() => useStore());

      act(() => {
        useStore.setState({ chatUploadFileList: [{ id: 'file-1' }] as any });
      });

      await act(async () => {
        await result.current.removeChatUploadFile('file-1');
      });

      expect(result.current.chatUploadFileList).toEqual([]);
      expect(removeFile).toHaveBeenCalledWith('file-1');
    });

    it('skips file deletion for a restored item (skipRemoveFile)', async () => {
      const removeFile = vi.spyOn(fileService, 'removeFile').mockResolvedValue(undefined);
      const { result } = renderHook(() => useStore());

      act(() => {
        useStore.setState({
          chatUploadFileList: [{ id: 'file-1', skipRemoveFile: true }] as any,
        });
      });

      await act(async () => {
        await result.current.removeChatUploadFile('file-1');
      });

      // draft entry is dropped, but the persisted file backing the original
      // message must NOT be deleted
      expect(result.current.chatUploadFileList).toEqual([]);
      expect(removeFile).not.toHaveBeenCalled();
    });
  });
});
