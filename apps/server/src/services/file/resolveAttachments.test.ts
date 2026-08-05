import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FileModel } from '@/database/models/file';
import { DocumentService } from '@/server/services/document';
import { FileService } from '@/server/services/file';

import { resolveAttachmentsByFileIds } from './resolveAttachments';

const { findByIds, getFullFileUrl, parseFile } = vi.hoisted(() => ({
  findByIds: vi.fn(),
  getFullFileUrl: vi.fn(),
  parseFile: vi.fn(),
}));

vi.mock('@/database/models/file', () => ({
  FileModel: vi.fn().mockImplementation(() => ({ findByIds })),
}));

vi.mock('@/server/services/document', () => ({
  DocumentService: vi.fn().mockImplementation(() => ({ parseFile })),
}));

vi.mock('@/server/services/file', () => ({
  FileService: vi.fn().mockImplementation(() => ({ getFullFileUrl })),
}));

describe('resolveAttachmentsByFileIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFullFileUrl.mockImplementation(async (url: string) => `${url}?signed=1`);
    parseFile.mockResolvedValue({ content: 'parsed document body' });
  });

  it('keeps spreadsheets metadata-only while parsing ordinary documents', async () => {
    findByIds.mockResolvedValue([
      {
        fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        id: 'file-xlsx',
        name: 'report.xlsx',
        size: 2048,
        url: 'https://files.example.com/report.xlsx',
      },
      {
        fileType: 'text/csv',
        id: 'file-csv',
        name: 'transactions.csv',
        size: 4096,
        url: 'https://files.example.com/transactions.csv',
      },
      {
        fileType: 'application/pdf',
        id: 'file-pdf',
        name: 'guide.pdf',
        size: 1024,
        url: 'https://files.example.com/guide.pdf',
      },
    ]);

    const result = await resolveAttachmentsByFileIds({
      db: {} as never,
      fileIds: ['file-xlsx', 'file-csv', 'file-pdf'],
      metadataOnlySpreadsheets: true,
      userId: 'user-1',
    });

    expect(FileModel).toHaveBeenCalledWith({}, 'user-1', undefined);
    expect(FileService).toHaveBeenCalledWith({}, 'user-1', undefined);
    expect(DocumentService).toHaveBeenCalledWith({}, 'user-1', undefined);
    expect(parseFile).toHaveBeenCalledOnce();
    expect(parseFile).toHaveBeenCalledWith('file-pdf');
    expect(result.fileList).toEqual([
      expect.objectContaining({ content: undefined, id: 'file-xlsx' }),
      expect.objectContaining({ content: undefined, id: 'file-csv' }),
      expect.objectContaining({ content: 'parsed document body', id: 'file-pdf' }),
    ]);
    expect(result.orderedFileIds).toEqual(['file-xlsx', 'file-csv', 'file-pdf']);
  });

  it('keeps the upstream spreadsheet parsing behavior in ordinary Chat by default', async () => {
    findByIds.mockResolvedValue([
      {
        fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        id: 'file-xlsx',
        name: 'small.xlsx',
        size: 2048,
        url: 'https://files.example.com/small.xlsx',
      },
    ]);

    const result = await resolveAttachmentsByFileIds({
      db: {} as never,
      fileIds: ['file-xlsx'],
      userId: 'user-1',
    });

    expect(parseFile).toHaveBeenCalledOnce();
    expect(parseFile).toHaveBeenCalledWith('file-xlsx');
    expect(result.fileList).toEqual([
      expect.objectContaining({ content: 'parsed document body', id: 'file-xlsx' }),
    ]);
  });
});
