// @vitest-environment node
import { TRPCError } from '@trpc/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CottiPlatformAdminAccessService } from '@/server/services/cotti/adminAccess';

import { cottiRouter } from './index';

const mocks = vi.hoisted(() => ({
  CottiModelDisplayModel: vi.fn(),
  getConfig: vi.fn(),
  getEnabledModelDisplayItems: vi.fn(),
  getServerGlobalConfig: vi.fn(),
  updateConfig: vi.fn(),
}));

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(async () => ({})),
}));

vi.mock('@/database/models/cottiModelDisplay', () => ({
  CottiModelDisplayModel: mocks.CottiModelDisplayModel,
  getEnabledModelDisplayItems: mocks.getEnabledModelDisplayItems,
}));

vi.mock('@/server/globalConfig', () => ({
  getServerGlobalConfig: mocks.getServerGlobalConfig,
}));

const config = {
  agent: [{ displayName: '专业模型', enabled: true, model: 'pro-model', provider: 'vertexai' }],
  chat: [{ displayName: '快速模型', enabled: true, model: 'fast-model', provider: 'vertexai' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.CottiModelDisplayModel.mockImplementation(() => ({
    getConfig: mocks.getConfig,
    updateConfig: mocks.updateConfig,
  }));
  mocks.getConfig.mockResolvedValue(config);
  mocks.getEnabledModelDisplayItems.mockReturnValue([...config.chat, ...config.agent]);
  mocks.updateConfig.mockResolvedValue({ config });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const mockAdminAccess = () =>
  vi.spyOn(CottiPlatformAdminAccessService.prototype, 'requireAccess').mockResolvedValue({
    email: 'admin@example.com',
    normalizedEmail: 'admin@example.com',
    source: 'email_allowlist',
    userId: 'admin-user',
  });

describe('cotti.modelDisplay router', () => {
  it('allows an unauthenticated caller to read the current configuration', async () => {
    const requireAccess = vi.spyOn(CottiPlatformAdminAccessService.prototype, 'requireAccess');
    const caller = cottiRouter.createCaller({ userId: null });

    await expect(caller.modelDisplay.detail()).resolves.toEqual({ data: config, success: true });
    expect(requireAccess).not.toHaveBeenCalled();
  });

  it('rejects model options access from a non-admin user', async () => {
    vi.spyOn(CottiPlatformAdminAccessService.prototype, 'requireAccess').mockRejectedValue(
      new TRPCError({ code: 'FORBIDDEN', message: 'COTTI platform admin access denied' }),
    );
    const caller = cottiRouter.createCaller({ userId: 'member-user' });

    await expect(caller.modelDisplay.options()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mocks.getServerGlobalConfig).not.toHaveBeenCalled();
  });

  it('returns enabled unique Chat model options in label order', async () => {
    mockAdminAccess();
    mocks.getServerGlobalConfig.mockResolvedValue({
      aiProvider: {
        disabled: {
          enabled: false,
          serverModelLists: [{ displayName: 'Ignored', id: 'ignored', type: 'chat' }],
        },
        openai: {
          enabled: true,
          serverModelLists: [
            { displayName: 'Zulu', id: 'z-model', type: 'chat' },
            { displayName: 'Image', id: 'image-model', type: 'image' },
            { displayName: 'Duplicate', id: 'Z-MODEL', type: 'chat' },
          ],
        },
        vertexai: {
          enabled: true,
          serverModelLists: [{ displayName: 'Alpha', id: 'a-model' }],
        },
      },
    });
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(caller.modelDisplay.options()).resolves.toEqual({
      data: [
        {
          displayName: 'Alpha',
          label: 'Alpha (vertexai/a-model)',
          model: 'a-model',
          provider: 'vertexai',
        },
        {
          displayName: 'Zulu',
          label: 'Zulu (openai/z-model)',
          model: 'z-model',
          provider: 'openai',
        },
      ],
      success: true,
    });
  });

  it('updates Chat and Agent lists and records the administrator', async () => {
    mockAdminAccess();
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(caller.modelDisplay.update(config)).resolves.toEqual({
      data: { config, visibleModels: [...config.chat, ...config.agent] },
      message: 'COTTI model display configuration updated',
      success: true,
    });
    expect(mocks.updateConfig).toHaveBeenCalledWith(config, 'admin-user');
  });

  it('rejects more than 50 models in either list', async () => {
    mockAdminAccess();
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });
    const item = { enabled: true, model: 'model', provider: 'provider' };

    await expect(
      caller.modelDisplay.update({ agent: [], chat: Array.from({ length: 51 }, () => item) }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(mocks.updateConfig).not.toHaveBeenCalled();
  });

  it('rejects blank model and provider identifiers', async () => {
    mockAdminAccess();
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(
      caller.modelDisplay.update({
        agent: [],
        chat: [{ enabled: true, model: '', provider: '' }],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(mocks.updateConfig).not.toHaveBeenCalled();
  });
});
