// @vitest-environment node
import type { LobeChatDatabase } from '@lobechat/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveAttachmentMetadata, resolveAttachmentsByFileIds } from './resolveAttachments';

const mocks = vi.hoisted(() => ({
  findByIds: vi.fn(),
  parseFile: vi.fn(),
  getFullFileUrl: vi.fn(),
}));

vi.mock('@/database/models/file', () => ({
  FileModel: vi.fn().mockImplementation(function () {
    return { findByIds: mocks.findByIds };
  }),
}));

vi.mock('@/server/services/document', () => ({
  DocumentService: vi.fn().mockImplementation(function () {
    return { parseFile: mocks.parseFile };
  }),
}));

vi.mock('@/server/services/file', () => ({
  FileService: vi.fn().mockImplementation(function () {
    return { getFullFileUrl: mocks.getFullFileUrl };
  }),
  getFileProxyUrl: (fileId: string) => `https://app.lobehub.com/f/${fileId}`,
}));

describe('resolveAttachmentMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a stable proxy URL alongside refreshed preview URLs', async () => {
    mocks.findByIds.mockResolvedValue([
      {
        fileType: 'application/pdf',
        id: 'file_historical',
        name: 'report.pdf',
        size: 42,
        url: 'tasks/report.pdf',
      },
    ]);
    mocks.getFullFileUrl.mockResolvedValue(
      'https://storage.example.com/tasks/report.pdf?X-Amz-Signature=current',
    );

    const result = await resolveAttachmentMetadata({
      db: {} as LobeChatDatabase,
      fileIds: ['file_historical'],
      userId: 'user-1',
    });

    expect(result).toEqual([
      {
        downloadUrl: 'https://app.lobehub.com/f/file_historical',
        fileType: 'application/pdf',
        id: 'file_historical',
        name: 'report.pdf',
        size: 42,
        url: 'https://storage.example.com/tasks/report.pdf?X-Amz-Signature=current',
      },
    ]);
  });
});

it('rejects large CSV before parsing in Chat and keeps its original URL in Agent', async () => {
  mocks.findByIds.mockResolvedValue([
    { id: 'large', name: 'data.csv', fileType: 'text/csv', size: 83_575_699, url: 'data.csv' },
  ]);
  mocks.getFullFileUrl.mockResolvedValue('https://files.example.com/data.csv');
  const args = { db: {} as LobeChatDatabase, fileIds: ['large'], userId: 'user-1' };
  await expect(resolveAttachmentsByFileIds(args)).rejects.toThrow('Switch to Agent mode');
  expect(mocks.parseFile).not.toHaveBeenCalled();
  const result = await resolveAttachmentsByFileIds({ ...args, metadataOnlySpreadsheets: true });
  expect(result.fileList[0].url).toBe('https://files.example.com/data.csv');
  expect(result.fileList[0].content).toBeUndefined();
  expect(mocks.parseFile).not.toHaveBeenCalled();
});
