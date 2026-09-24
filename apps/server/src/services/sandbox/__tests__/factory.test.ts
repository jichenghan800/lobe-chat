import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MarketService } from '@/server/services/market';

const routing = vi.hoisted(() => ({ selected: undefined as 'market' | 'onlyboxes' | undefined }));
vi.mock('@/database/core/db-adaptor', () => ({ getServerDB: async () => ({}) }));
vi.mock('@/database/models/cottiSandbox', () => ({
  CottiSandboxModel: class {
    async getTopicProvider() {
      return routing.selected;
    }
  },
}));

const baseOptions = {
  marketService: {} as MarketService,
  topicId: 'topic-1',
  userId: 'user-1',
};

describe('sandbox service factory', () => {
  beforeEach(() => {
    vi.resetModules();
    routing.selected = undefined;
  });

  it('uses the market provider by default', async () => {
    vi.doMock('@/envs/sandbox', () => ({
      sandboxEnv: {},
    }));

    const { createSandboxService } = await import('../factory');
    const service = await createSandboxService(baseOptions);

    expect(service.kind).toBe('market');
    expect(service.capabilities).toMatchObject({
      backgroundCommands: true,
      exportFile: true,
      files: true,
      persistentSession: true,
      shell: true,
      skillScripts: true,
    });
  });

  it('uses the onlyboxes provider when configured', async () => {
    vi.doMock('@/envs/app', () => ({
      appEnv: {
        APP_URL: 'https://lobehub.example.com',
      },
    }));
    vi.doMock('@/envs/sandbox', () => ({
      sandboxEnv: {
        ONLYBOXES_BASE_URL: 'https://onlyboxes.example.com',
        ONLYBOXES_JIT_SIGNING_KEY: 'jit-signing-key',
        SANDBOX_PROVIDER: 'onlyboxes',
      },
    }));

    const { createSandboxService } = await import('../factory');
    const service = await createSandboxService(baseOptions);

    expect(service.kind).toBe('onlyboxes');
    expect(service.capabilities.languages).toEqual(['python', 'javascript', 'typescript']);
  });
  it('uses the topic choice even when the global default is cloud', async () => {
    routing.selected = 'onlyboxes';
    vi.doMock('@/envs/sandbox', () => ({
      sandboxEnv: {
        SANDBOX_PROVIDER: 'market',
        ONLYBOXES_ENABLED: true,
        ONLYBOXES_BASE_URL: 'https://onlyboxes.example.com',
        ONLYBOXES_JIT_SIGNING_KEY: 'test-key',
      },
    }));
    const { createSandboxService } = await import('../factory');
    expect((await createSandboxService(baseOptions)).kind).toBe('onlyboxes');
    routing.selected = 'market';
    expect((await createSandboxService(baseOptions)).kind).toBe('market');
  });
  it('never falls back to cloud when self-hosted execution is unavailable', async () => {
    routing.selected = 'onlyboxes';
    vi.doMock('@/envs/sandbox', () => ({ sandboxEnv: { SANDBOX_PROVIDER: 'market' } }));
    const { createSandboxService } = await import('../factory');
    await expect(createSandboxService(baseOptions)).rejects.toThrow('will not switch to cloud');
  });
});
