import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LobeChatDatabase } from '@/database/type';
import type { FileService } from '@/server/services/file';
import type { MarketService } from '@/server/services/market';

import { SandboxMiddlewareService } from '../service';
import type { SandboxProvider } from '../types';

const findFilesToInitInSandbox = vi.fn();

vi.mock('@/database/models/file', () => ({
  FileModel: vi.fn().mockImplementation(() => ({ findFilesToInitInSandbox })),
}));

const createProvider = (): SandboxProvider =>
  ({
    capabilities: {
      backgroundCommands: true,
      exportFile: true,
      files: true,
      languages: ['python'],
      persistentSession: true,
      shell: true,
      skillScripts: true,
    },
    callTool: vi.fn(async () => ({ result: {}, success: true })),
    exportFileToUploadUrl: vi.fn(),
    kind: 'onlyboxes',
  }) satisfies SandboxProvider;

const createFileService = (): FileService =>
  ({
    createCachedPreSignedUrlForPreview: vi.fn(async () => 'https://download.example.com/x'),
  }) as unknown as FileService;

const baseOptions = () => ({
  fileService: createFileService(),
  marketService: {} as MarketService,
  serverDB: {} as LobeChatDatabase,
  topicId: 'topic-1',
  userId: 'user-1',
});

describe('SandboxMiddlewareService file initialization', () => {
  beforeEach(() => {
    findFilesToInitInSandbox.mockReset();
    findFilesToInitInSandbox.mockResolvedValue([
      { fileType: 'text/csv', id: 'f1', name: 'data.csv', size: 10, url: 'key-1' },
    ]);
  });

  it('syncs later attachments in the same sandbox without resyncing rotated URLs or reordered files', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'sandbox-attachment-'));
    const provider = createProvider();
    const options = baseOptions();
    const a = { fileType: 'text/csv', id: 'a', name: 'a.csv', size: 10, url: 'key-a' };
    const b = { ...a, id: 'b', name: 'b.csv', url: 'key-b' };
    vi.mocked(provider.callTool).mockImplementation(async (tool, params) => {
      if (tool === 'runCommand') {
        const command = String(params.command).replaceAll('/mnt/data', directory);
        await promisify(execFile)('bash', [
          '-c',
          `curl() { printf synthetic > "$4"; printf x >> '${directory}/downloads'; }; ${command}`,
        ]);
      }
      return { result: {}, success: true };
    });
    const sync = async (files: (typeof a)[]) => {
      findFilesToInitInSandbox.mockResolvedValue(files);
      await new SandboxMiddlewareService(provider, options).callTool('listFiles', {});
    };
    try {
      await sync([]);
      await sync([a]);
      expect(await readFile(path.join(directory, 'a.csv'), 'utf8')).toBe('synthetic');
      await sync([a, b]);
      expect(await readFile(path.join(directory, 'b.csv'), 'utf8')).toBe('synthetic');
      const count = await readFile(path.join(directory, 'downloads'), 'utf8');
      vi.mocked(options.fileService.createCachedPreSignedUrlForPreview).mockResolvedValue(
        'https://rotated.invalid',
      );
      await sync([b, a]);
      expect(await readFile(path.join(directory, 'downloads'), 'utf8')).toBe(count);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('syncs uploaded files into the sandbox before the first tool call', async () => {
    const provider = createProvider();
    const service = new SandboxMiddlewareService(provider, baseOptions());

    await service.callTool('listFiles', { directoryPath: '/mnt/data' });

    expect(findFilesToInitInSandbox).toHaveBeenCalledWith('topic-1');
    expect(provider.callTool).toHaveBeenNthCalledWith(
      1,
      'runCommand',
      expect.objectContaining({ command: expect.stringContaining('curl') }),
    );
    expect(provider.callTool).toHaveBeenNthCalledWith(2, 'listFiles', {
      directoryPath: '/mnt/data',
    });
  });

  it('only runs the sync once per service instance', async () => {
    const provider = createProvider();
    const service = new SandboxMiddlewareService(provider, baseOptions());

    await service.callTool('listFiles', {});
    await service.callTool('readFile', { path: '/mnt/data/data.csv' });

    const runCommandCalls = (provider.callTool as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([tool]) => tool === 'runCommand',
    );
    expect(runCommandCalls).toHaveLength(1);
  });

  it('skips the sync when there is no serverDB', async () => {
    const provider = createProvider();
    const service = new SandboxMiddlewareService(provider, {
      ...baseOptions(),
      serverDB: undefined,
    });

    await service.callTool('listFiles', {});

    expect(findFilesToInitInSandbox).not.toHaveBeenCalled();
    expect(provider.callTool).toHaveBeenCalledTimes(1);
    expect(provider.callTool).toHaveBeenCalledWith('listFiles', {});
  });

  it('does not sync when there are no uploaded files', async () => {
    findFilesToInitInSandbox.mockResolvedValue([]);
    const provider = createProvider();
    const service = new SandboxMiddlewareService(provider, baseOptions());

    await service.callTool('listFiles', {});

    expect(provider.callTool).toHaveBeenCalledTimes(1);
    expect(provider.callTool).toHaveBeenCalledWith('listFiles', {});
  });

  it('never blocks the tool call when the sync fails', async () => {
    findFilesToInitInSandbox.mockRejectedValue(new Error('db down'));
    const provider = createProvider();
    const service = new SandboxMiddlewareService(provider, baseOptions());

    await expect(service.callTool('listFiles', {})).resolves.toMatchObject({ success: true });
    expect(provider.callTool).toHaveBeenCalledWith('listFiles', {});
  });

  it('skips files exceeding the size cap, matching what the prompt advertises', async () => {
    findFilesToInitInSandbox.mockResolvedValue([
      {
        fileType: 'application/zip',
        id: 'big',
        name: 'huge.zip',
        size: 200 * 1024 * 1024,
        url: 'k',
      },
    ]);
    const provider = createProvider();
    const service = new SandboxMiddlewareService(provider, baseOptions());

    await service.callTool('listFiles', {});

    // oversized file is filtered out → nothing to download → only the real tool runs
    expect(provider.callTool).toHaveBeenCalledTimes(1);
    expect(provider.callTool).toHaveBeenCalledWith('listFiles', {});
  });
});
