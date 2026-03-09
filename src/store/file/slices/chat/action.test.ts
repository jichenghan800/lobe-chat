import { DocumentSourceType, type LobeDocument } from '@lobechat/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { notification } from '@/components/AntdStaticMethods';
import { ragService } from '@/services/rag';
import { initialState } from '@/store/file/initialState';

import { useFileStore as useStore } from '../../store';

vi.mock('zustand/traditional');

// Mock necessary modules and functions
vi.mock('@/components/AntdStaticMethods', () => ({
  notification: {
    error: vi.fn(),
  },
}));

vi.mock('@/services/rag', () => ({
  ragService: {
    parseFileContent: vi.fn(),
  },
}));

vi.mock('i18next', () => ({
  t: (key: string, options?: Record<string, any>) => options?.reason ?? key,
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
  useStore.setState(
    {
      chatContextSelections: initialState.chatContextSelections,
      chatUploadFileList: initialState.chatUploadFileList,
    },
    false,
  );
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

  it('uploadChatFiles should keep PDF attachments processing until parseFileContent resolves', async () => {
    const { result } = renderHook(() => useStore());
    const file = new File(['resume'], 'resume.pdf', { type: 'application/pdf' });
    const parsedDocument: LobeDocument = {
      content: 'resume content',
      createdAt: new Date('2026-03-09T00:00:00.000Z'),
      editorData: null,
      filename: 'resume.pdf',
      fileType: 'application/pdf',
      id: 'doc-1',
      metadata: {},
      source: 'files://resume.pdf',
      sourceType: DocumentSourceType.FILE,
      totalCharCount: 14,
      totalLineCount: 1,
      updatedAt: new Date('2026-03-09T00:00:00.000Z'),
    };

    let resolveParse!: () => void;
    const parsePromise = new Promise<LobeDocument>((resolve) => {
      resolveParse = () => resolve(parsedDocument);
    });

    vi.spyOn(useStore.getState(), 'uploadWithProgress').mockImplementation(
      async ({ file, onStatusUpdate }) => {
        onStatusUpdate?.({
          id: file.name,
          type: 'updateFile',
          value: {
            fileUrl: 'https://example.com/resume.pdf',
            id: 'file-1',
            status: 'success',
            uploadState: { progress: 100, restTime: 0, speed: 0 },
          },
        });

        return { id: 'file-1', url: 'https://example.com/resume.pdf' };
      },
    );

    vi.mocked(ragService.parseFileContent).mockImplementation(() => parsePromise);

    const uploadTask = result.current.uploadChatFiles([file]);

    await waitFor(() => {
      expect(useStore.getState().chatUploadFileList).toEqual([
        expect.objectContaining({
          id: 'file-1',
          status: 'processing',
          uploadState: { progress: 100, restTime: 0, speed: 0 },
        }),
      ]);
    });

    resolveParse();
    await uploadTask;

    await waitFor(() => {
      expect(useStore.getState().chatUploadFileList).toEqual([
        expect.objectContaining({
          id: 'file-1',
          status: 'success',
          tasks: undefined,
        }),
      ]);
    });

    expect(ragService.parseFileContent).toHaveBeenCalledWith('file-1');
  });

  it('uploadChatFiles should surface parse errors and keep the broken file blocked', async () => {
    const { result } = renderHook(() => useStore());
    const file = new File(['resume'], 'resume.pdf', { type: 'application/pdf' });

    vi.spyOn(useStore.getState(), 'uploadWithProgress').mockImplementation(
      async ({ file, onStatusUpdate }) => {
        onStatusUpdate?.({
          id: file.name,
          type: 'updateFile',
          value: {
            fileUrl: 'https://example.com/resume.pdf',
            id: 'file-2',
            status: 'success',
            uploadState: { progress: 100, restTime: 0, speed: 0 },
          },
        });

        return { id: 'file-2', url: 'https://example.com/resume.pdf' };
      },
    );

    vi.mocked(ragService.parseFileContent).mockRejectedValue(new Error('parse failed'));

    await result.current.uploadChatFiles([file]);

    await waitFor(() => {
      expect(useStore.getState().chatUploadFileList).toEqual([
        expect.objectContaining({
          id: 'file-2',
          status: 'success',
          tasks: expect.objectContaining({
            chunkingStatus: 'error',
            finishEmbedding: false,
          }),
        }),
      ]);
    });

    expect(notification.error).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'parse failed',
      }),
    );
  });
});
