import type { AiProviderRuntimeState } from 'model-bank';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ModelDisplayConfig } from '@/types/modelDisplay';

import {
  getCottiScopedAiProviderModelList,
  getCottiScopedAiProviderRuntimeState,
} from './modelDisplayAccess';

const mocks = vi.hoisted(() => ({
  getHiddenBuiltinModelsForUser: vi.fn(),
  getModelRedirects: vi.fn(async () => ({})),
}));

vi.mock('@/business/server/aiProvider', () => ({
  getHiddenBuiltinModelsForUser: mocks.getHiddenBuiltinModelsForUser,
  getModelRedirects: mocks.getModelRedirects,
}));

const config = {
  agent: [
    {
      displayName: 'Agent Model',
      enabled: true,
      model: 'agent-model',
      provider: 'openai',
    },
  ],
  chat: [
    {
      displayName: 'COTTI Visible',
      enabled: true,
      model: 'visible-chat',
      provider: 'openai',
    },
    {
      displayName: 'COTTI Hidden',
      enabled: true,
      model: 'upstream-hidden-chat',
      provider: 'openai',
    },
  ],
} satisfies ModelDisplayConfig;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getHiddenBuiltinModelsForUser.mockResolvedValue([]);
});

describe('getCottiScopedAiProviderModelList', () => {
  it('applies upstream access first, keeps non-Chat models, and paginates last', async () => {
    const imageModel = { enabled: true, id: 'image-model', type: 'image' as const };
    const visibleChatModel = {
      displayName: 'Original Name',
      enabled: true,
      id: 'visible-chat',
      type: 'chat' as const,
    };
    const loadModelList = vi
      .fn()
      .mockResolvedValue([
        { enabled: true, id: 'upstream-hidden-chat', type: 'chat' },
        { enabled: true, id: 'not-configured-chat', type: 'chat' },
        visibleChatModel,
        imageModel,
        { enabled: true, id: 'agent-model', type: 'chat' },
      ]);
    mocks.getHiddenBuiltinModelsForUser.mockResolvedValue([
      { id: 'upstream-hidden-chat', providerId: 'openai' },
    ]);

    const result = await getCottiScopedAiProviderModelList(
      'user-1',
      'openai',
      { limit: 2, offset: 1 },
      loadModelList,
      async () => config,
    );

    expect(result).toEqual([
      imageModel,
      { enabled: true, id: 'agent-model', displayName: 'Agent Model', type: 'chat' },
    ]);
    expect(loadModelList).toHaveBeenCalledWith({ limit: undefined, offset: undefined });
  });

  it('does not re-enable a model hidden by the upstream user policy', async () => {
    const loadModelList = vi
      .fn()
      .mockResolvedValue([{ enabled: true, id: 'upstream-hidden-chat', type: 'chat' }]);
    mocks.getHiddenBuiltinModelsForUser.mockResolvedValue([
      { id: 'upstream-hidden-chat', providerId: 'openai' },
    ]);

    const result = await getCottiScopedAiProviderModelList(
      'user-1',
      'openai',
      {},
      loadModelList,
      async () => config,
    );

    expect(result).toEqual([]);
  });
});

describe('getCottiScopedAiProviderRuntimeState', () => {
  it('filters only Chat models, overrides their display names, and recalculates providers', async () => {
    const openaiProvider = { id: 'openai', source: 'builtin' as const };
    const vertexProvider = { id: 'vertexai', source: 'builtin' as const };
    const visibleChatModel = {
      abilities: {},
      displayName: 'Original Name',
      enabled: true,
      id: 'visible-chat',
      providerId: 'openai',
      type: 'chat' as const,
    };
    const imageModel = {
      abilities: {},
      enabled: true,
      id: 'image-model',
      providerId: 'vertexai',
      type: 'image' as const,
    };
    const videoModel = {
      abilities: {},
      enabled: true,
      id: 'video-model',
      providerId: 'vertexai',
      type: 'video' as const,
    };
    const runtimeState: AiProviderRuntimeState = {
      enabledAiModels: [
        visibleChatModel,
        {
          abilities: {},
          enabled: true,
          id: 'not-configured-chat',
          providerId: 'vertexai',
          type: 'chat',
        },
        imageModel,
        videoModel,
      ],
      enabledAiProviders: [openaiProvider, vertexProvider],
      enabledChatAiProviders: [openaiProvider, vertexProvider],
      enabledImageAiProviders: [vertexProvider],
      enabledVideoAiProviders: [vertexProvider],
      runtimeConfig: {},
    };

    const result = await getCottiScopedAiProviderRuntimeState(
      'user-1',
      async () => runtimeState,
      async () => config,
    );

    expect(result.enabledAiModels).toEqual([
      { ...visibleChatModel, displayName: 'COTTI Visible' },
      imageModel,
      videoModel,
    ]);
    expect(result.enabledChatAiProviders).toEqual([openaiProvider]);
    expect(result.enabledImageAiProviders).toEqual([vertexProvider]);
    expect(result.enabledVideoAiProviders).toEqual([vertexProvider]);
    expect(result.enabledAiProviders).toEqual([openaiProvider, vertexProvider]);
  });
});

describe('Agent-only runtime visibility', () => {
  it('includes Qwen enabled only in Agent but excludes globally retired Sol', async () => {
    const qwen = { model: 'qwen3.8-max-0902', provider: 'qwen' };
    const sol = { model: 'gpt-5.6-sol', provider: 'azure' };
    const policy: ModelDisplayConfig = {
      agent: [
        { ...qwen, enabled: true, displayName: '千问3.8-Max' },
        { ...sol, enabled: true },
      ],
      chat: [
        { ...qwen, enabled: false },
        { ...sol, enabled: false },
      ],
      retirements: [
        { source: sol, target: { provider: 'azure', model: 'gpt-5.6-terra' }, at: '', by: 'admin' },
      ],
    };
    const providers = [qwen, sol].map(({ provider }) => ({
      id: provider,
      source: 'builtin' as const,
    }));
    const models = [qwen, sol].map(({ provider, model }) => ({
      id: model,
      providerId: provider,
      enabled: true,
      abilities: {},
      type: 'chat' as const,
    }));
    const result = await getCottiScopedAiProviderRuntimeState(
      'user-1',
      async () => ({
        enabledAiModels: models,
        enabledAiProviders: providers,
        enabledChatAiProviders: providers,
        enabledImageAiProviders: [],
        enabledVideoAiProviders: [],
        runtimeConfig: {},
      }),
      async () => policy,
    );
    expect(result.enabledAiModels).toEqual([{ ...models[0], displayName: '千问3.8-Max' }]);
    expect(result.enabledChatAiProviders).toEqual([providers[0]]);
    const list = await getCottiScopedAiProviderModelList(
      'user-1',
      'qwen',
      {},
      async () => [models[0]],
      async () => policy,
    );
    expect(list).toEqual([{ ...models[0], displayName: '千问3.8-Max' }]);
  });
});
