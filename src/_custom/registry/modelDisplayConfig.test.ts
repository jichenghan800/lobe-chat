import { describe, expect, it } from 'vitest';

import type { ModelDisplayConfig } from '@/types/modelDisplay';

import {
  applyModelDisplayConfig,
  getCottiProfessionalModel,
  getModelDisplayDefault,
  resolveModelDisplayTargetModel,
  switchCottiProfessionalModelInConfig,
} from './modelDisplayConfig';

describe('applyModelDisplayConfig', () => {
  it('filters, orders, and renames provider model lists from one display scope', () => {
    const result = applyModelDisplayConfig(
      [
        {
          children: [
            { displayName: 'Azure GPT', id: 'gpt-5.5' },
            { displayName: 'GPT 4o', id: 'gpt-4o' },
          ],
          id: 'azure',
        },
        {
          children: [{ displayName: 'OpenAI GPT', id: 'gpt-5.5' }],
          id: 'openai',
        },
      ],
      [
        { displayName: '全能效率', enabled: true, model: 'GPT-5.5', provider: 'OpenAI' },
        { displayName: 'Azure 全能', enabled: true, model: 'gpt-5.5', provider: 'azure' },
        { enabled: false, model: 'gpt-4o', provider: 'azure' },
      ],
    );

    expect(result).toEqual([
      {
        children: [{ displayName: '全能效率', id: 'gpt-5.5' }],
        id: 'openai',
      },
      {
        children: [{ displayName: 'Azure 全能', id: 'gpt-5.5' }],
        id: 'azure',
      },
    ]);
  });

  it('returns an empty list when the selected scope has no enabled models', () => {
    expect(
      applyModelDisplayConfig(
        [{ children: [{ id: 'gpt-5.5' }], id: 'openai' }],
        [{ enabled: false, model: 'gpt-5.5', provider: 'openai' }],
      ),
    ).toEqual([]);
  });

  it('returns undefined until the display config is available', () => {
    expect(
      applyModelDisplayConfig([{ children: [{ id: 'gpt-5.5' }], id: 'openai' }], undefined),
    ).toBeUndefined();
  });

  it('uses an explicit default instead of the first model in the target list', () => {
    const displayConfig = {
      agent: [
        { enabled: true, model: 'first-model', provider: 'openai' },
        { enabled: true, model: 'agent-default', provider: 'openai' },
      ],
      chat: [{ enabled: true, model: 'chat-only', provider: 'openai' }],
      defaults: {
        agent: { model: 'agent-default', provider: 'openai' },
        chat: { model: 'chat-only', provider: 'openai' },
      },
    };

    expect(getModelDisplayDefault(displayConfig, 'agent')).toEqual({
      model: 'agent-default',
      provider: 'openai',
    });
    expect(
      resolveModelDisplayTargetModel({
        availableModels: [
          {
            children: [{ id: 'first-model' }, { id: 'agent-default' }],
            id: 'openai',
          },
        ],
        config: displayConfig,
        currentModel: { model: 'chat-only', provider: 'openai' },
        targetScope: 'agent',
      }),
    ).toEqual({ model: 'agent-default', provider: 'openai' });
  });

  it('keeps the current model when it is enabled and available in the target scope', () => {
    const displayConfig = {
      agent: [{ enabled: true, model: 'shared-model', provider: 'openai' }],
      chat: [{ enabled: true, model: 'shared-model', provider: 'openai' }],
      defaults: { agent: { model: 'shared-model', provider: 'openai' } },
    };

    expect(
      resolveModelDisplayTargetModel({
        availableModels: [{ children: [{ id: 'shared-model' }], id: 'openai' }],
        config: displayConfig,
        currentModel: { model: 'shared-model', provider: 'openai' },
        targetScope: 'agent',
      }),
    ).toEqual({ model: 'shared-model', provider: 'openai' });
  });

  it('does not select a configured default hidden by the upstream user policy', () => {
    const displayConfig = {
      agent: [{ enabled: true, model: 'agent-default', provider: 'openai' }],
      chat: [{ enabled: true, model: 'chat-only', provider: 'openai' }],
      defaults: { agent: { model: 'agent-default', provider: 'openai' } },
    };

    expect(
      resolveModelDisplayTargetModel({
        availableModels: [],
        config: displayConfig,
        currentModel: { model: 'chat-only', provider: 'openai' },
        targetScope: 'agent',
      }),
    ).toBeUndefined();
  });
});

const config: ModelDisplayConfig = {
  agent: [
    { displayName: 'Other', enabled: true, model: 'other-agent', provider: 'test' },
    {
      displayName: 'COTTI-专业',
      enabled: true,
      model: 'gemini-3.7-flash',
      provider: 'vertexai',
    },
  ],
  chat: [
    { displayName: 'COTTI-快速', enabled: true, model: 'fast', provider: 'vertexai' },
    {
      displayName: 'COTTI-专业',
      enabled: true,
      model: 'gemini-3.7-flash',
      provider: 'vertexai',
    },
  ],
  defaults: {
    agent: { model: 'gemini-3.7-flash', provider: 'vertexai' },
    chat: { model: 'fast', provider: 'vertexai' },
  },
};

describe('COTTI professional model channel', () => {
  it('resolves the model backing the professional channel', () => {
    expect(getCottiProfessionalModel(config)).toEqual({
      model: 'gemini-3.7-flash',
      provider: 'vertexai',
    });
  });

  it('switches Chat and Agent mappings while preserving their positions and defaults', () => {
    const next = switchCottiProfessionalModelInConfig(config, 'gemini-3.6-flash');

    expect(next.agent.map(({ model }) => model)).toEqual(['other-agent', 'gemini-3.6-flash']);
    expect(next.chat.map(({ model }) => model)).toEqual(['fast', 'gemini-3.6-flash']);
    expect(next.agent[1]).toMatchObject({
      displayName: 'COTTI-专业',
      enabled: true,
      provider: 'vertexai',
    });
    expect(next.defaults).toEqual({
      agent: { model: 'gemini-3.6-flash', provider: 'vertexai' },
      chat: { model: 'fast', provider: 'vertexai' },
    });
  });

  it('collapses stale 3.6 and 3.7 rows into one visible professional channel', () => {
    const next = switchCottiProfessionalModelInConfig(
      {
        ...config,
        agent: [
          ...config.agent,
          { enabled: true, model: 'gemini-3.6-flash', provider: 'vertexai' },
        ],
      },
      'gemini-3.6-flash',
    );

    expect(
      next.agent.filter(
        ({ model }) => model === 'gemini-3.6-flash' || model === 'gemini-3.7-flash',
      ),
    ).toEqual([
      {
        displayName: 'COTTI-专业',
        enabled: true,
        model: 'gemini-3.6-flash',
        provider: 'vertexai',
      },
    ]);
  });
});
