// @vitest-environment node
import { TRPCError } from '@trpc/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CottiPlatformAdminAccessService } from '@/server/services/cotti/adminAccess';

import { cottiRouter } from './index';

const mocks = vi.hoisted(() => ({
  CottiModelDisplayModel: vi.fn(),
  previewTaskMigration: vi.fn(),
  migrateTasks: vi.fn(),
  getConfig: vi.fn(),
  getEnabledModelDisplayItems: vi.fn(),
  getProfessionalModelStatus: vi.fn(),
  getServerGlobalConfig: vi.fn(),
  switchProfessionalModel: vi.fn(),
  updateConfig: vi.fn(),
}));

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(async () => ({})),
}));

vi.mock('@/database/models/cottiModelDisplay', () => ({
  CottiModelDisplayModel: mocks.CottiModelDisplayModel,
  getEnabledModelDisplayItems: mocks.getEnabledModelDisplayItems,
}));

vi.mock('@/database/models/cottiTaskModelMigration', () => ({
  CottiTaskModelMigrationModel: class {
    preview = mocks.previewTaskMigration;
    migrate = mocks.migrateTasks;
  },
  CottiTaskModelMigrationError: class extends Error {},
}));

vi.mock('@/server/globalConfig', () => ({
  getServerGlobalConfig: mocks.getServerGlobalConfig,
}));

const config = {
  agent: [{ displayName: '专业模型', enabled: true, model: 'pro-model', provider: 'vertexai' }],
  chat: [{ displayName: '快速模型', enabled: true, model: 'fast-model', provider: 'vertexai' }],
  defaults: {
    agent: { model: 'pro-model', provider: 'vertexai' },
    chat: { model: 'fast-model', provider: 'vertexai' },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.previewTaskMigration.mockResolvedValue({ taskCount: 0 });
  mocks.CottiModelDisplayModel.mockImplementation(() => ({
    getConfig: mocks.getConfig,
    getProfessionalModelStatus: mocks.getProfessionalModelStatus,
    switchProfessionalModel: mocks.switchProfessionalModel,
    updateConfig: mocks.updateConfig,
  }));
  mocks.getConfig.mockResolvedValue(config);
  mocks.getEnabledModelDisplayItems.mockReturnValue([...config.chat, ...config.agent]);
  mocks.getProfessionalModelStatus.mockResolvedValue({
    affectedAgentCount: 35,
    currentModel: { model: 'gemini-3.6-flash', provider: 'vertexai' },
  });
  mocks.getServerGlobalConfig.mockResolvedValue({ aiProvider: {} });
  mocks.switchProfessionalModel.mockResolvedValue({
    affectedAgentCount: 35,
    config,
    previousModel: { model: 'gemini-3.6-flash', provider: 'vertexai' },
    targetModel: { model: 'gemini-3.7-flash', provider: 'vertexai' },
  });
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

  it('returns the current professional channel and only its deployed model versions', async () => {
    mockAdminAccess();
    mocks.getServerGlobalConfig.mockResolvedValue({
      aiProvider: {
        vertexai: {
          enabled: true,
          serverModelLists: [
            { displayName: 'Gemini 3.6 Flash', id: 'gemini-3.6-flash', type: 'chat' },
            { displayName: 'Gemini 3.7 Flash', id: 'gemini-3.7-flash', type: 'chat' },
            { displayName: 'Gemini 3.8 Flash', id: 'gemini-3.8-flash', type: 'chat' },
            { displayName: 'Fast', id: 'gemini-3.5-flash-lite', type: 'chat' },
          ],
        },
      },
    });
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(caller.modelDisplay.professionalModel()).resolves.toEqual({
      data: {
        affectedAgentCount: 35,
        currentModel: { model: 'gemini-3.6-flash', provider: 'vertexai' },
        options: [
          {
            displayName: 'Gemini 3.6 Flash',
            label: 'Gemini 3.6 Flash (vertexai/gemini-3.6-flash)',
            model: 'gemini-3.6-flash',
            provider: 'vertexai',
          },
          {
            displayName: 'Gemini 3.7 Flash',
            label: 'Gemini 3.7 Flash (vertexai/gemini-3.7-flash)',
            model: 'gemini-3.7-flash',
            provider: 'vertexai',
          },
          {
            displayName: 'Gemini 3.8 Flash',
            label: 'Gemini 3.8 Flash (vertexai/gemini-3.8-flash)',
            model: 'gemini-3.8-flash',
            provider: 'vertexai',
          },
        ],
      },
      success: true,
    });
  });

  it('switches the professional channel after validating the model is deployed', async () => {
    mockAdminAccess();
    mocks.getServerGlobalConfig.mockResolvedValue({
      aiProvider: {
        vertexai: {
          enabled: true,
          serverModelLists: [{ id: 'gemini-3.7-flash', type: 'chat' }],
        },
      },
    });
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(
      caller.modelDisplay.switchProfessionalModel({ model: 'gemini-3.7-flash' }),
    ).resolves.toMatchObject({
      data: {
        affectedAgentCount: 35,
        targetModel: { model: 'gemini-3.7-flash', provider: 'vertexai' },
      },
      success: true,
    });
    expect(mocks.switchProfessionalModel).toHaveBeenCalledWith('gemini-3.7-flash', 'admin-user');
  });

  it('rejects switching to a professional model that is not deployed', async () => {
    mockAdminAccess();
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(
      caller.modelDisplay.switchProfessionalModel({ model: 'gemini-3.7-flash' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(mocks.switchProfessionalModel).not.toHaveBeenCalled();
  });

  it('accepts a historical payload without defaults when both COTTI defaults are enabled', async () => {
    mockAdminAccess();
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });
    const historicalConfig = {
      agent: [{ enabled: true, model: 'gemini-3.6-flash', provider: 'vertexai' }],
      chat: [{ enabled: true, model: 'gemini-3.5-flash-lite', provider: 'vertexai' }],
    };
    mocks.getConfig.mockResolvedValueOnce(historicalConfig);
    mocks.updateConfig.mockResolvedValueOnce({ config: historicalConfig });

    await expect(caller.modelDisplay.update(historicalConfig)).resolves.toMatchObject({
      data: { config: historicalConfig },
      success: true,
    });
  });

  it('rejects a default model that is not enabled in its target list', async () => {
    mockAdminAccess();
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(
      caller.modelDisplay.update({
        ...config,
        defaults: {
          ...config.defaults,
          agent: { model: 'disabled-model', provider: 'vertexai' },
        },
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(mocks.updateConfig).not.toHaveBeenCalled();
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

describe('task model migration administration', () => {
  it('rejects migration preview and writes from ordinary users', async () => {
    vi.spyOn(CottiPlatformAdminAccessService.prototype, 'requireAccess').mockRejectedValue(
      new TRPCError({ code: 'FORBIDDEN' }),
    );
    const caller = cottiRouter.createCaller({ userId: 'ordinary-user' });
    await expect(
      caller.modelDisplay.taskMigrationPreview({ model: 'old', provider: 'azure' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      caller.modelDisplay.retireAndMigrateTasks({
        source: { model: 'old', provider: 'azure' },
        target: { model: 'new', provider: 'azure' },
        revision: 'a'.repeat(64),
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mocks.migrateTasks).not.toHaveBeenCalled();
  });
  it('rejects a replacement missing from deployed options', async () => {
    mockAdminAccess();
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });
    await expect(
      caller.modelDisplay.retireAndMigrateTasks({
        source: { model: 'old', provider: 'azure' },
        target: { model: 'missing', provider: 'azure' },
        revision: 'a'.repeat(64),
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(mocks.migrateTasks).not.toHaveBeenCalled();
  });
  it('prevents ordinary list saving from hiding an in-use model', async () => {
    mockAdminAccess();
    mocks.previewTaskMigration.mockResolvedValue({ taskCount: 3 });
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });
    const ref = { enabled: true, model: 'replacement', provider: 'azure' };
    await expect(
      caller.modelDisplay.update({
        agent: [ref],
        chat: [ref],
        defaults: { agent: ref, chat: ref },
      }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(mocks.updateConfig).not.toHaveBeenCalled();
  });
  it('rejects retiring from Agent alone even while Chat still lists the model', async () => {
    mockAdminAccess();
    const previous = await mocks.getConfig();
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });
    const agent = previous.agent.map((r: { model: string; enabled: boolean }) => ({
      ...r,
      enabled: r.model !== previous.agent[0].model,
    }));
    const replacement = { model: 'replacement', provider: 'azure', enabled: true };
    await expect(
      caller.modelDisplay.update({
        ...previous,
        agent: [...agent, replacement],
        defaults: { ...previous.defaults, agent: replacement },
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(mocks.updateConfig).not.toHaveBeenCalled();
  });
});
