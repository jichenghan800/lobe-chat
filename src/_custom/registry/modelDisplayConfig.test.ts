import { describe, expect, it } from 'vitest';

import {
  applyModelDisplayConfig,
  getModelDisplayDefault,
  resolveModelDisplayTargetModel,
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
    const config = {
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

    expect(getModelDisplayDefault(config, 'agent')).toEqual({
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
        config,
        currentModel: { model: 'chat-only', provider: 'openai' },
        targetScope: 'agent',
      }),
    ).toEqual({ model: 'agent-default', provider: 'openai' });
  });

  it('keeps the current model when it is enabled and available in the target scope', () => {
    const config = {
      agent: [{ enabled: true, model: 'shared-model', provider: 'openai' }],
      chat: [{ enabled: true, model: 'shared-model', provider: 'openai' }],
      defaults: { agent: { model: 'shared-model', provider: 'openai' } },
    };

    expect(
      resolveModelDisplayTargetModel({
        availableModels: [{ children: [{ id: 'shared-model' }], id: 'openai' }],
        config,
        currentModel: { model: 'shared-model', provider: 'openai' },
        targetScope: 'agent',
      }),
    ).toEqual({ model: 'shared-model', provider: 'openai' });
  });

  it('does not select a configured default hidden by the upstream user policy', () => {
    const config = {
      agent: [{ enabled: true, model: 'agent-default', provider: 'openai' }],
      chat: [{ enabled: true, model: 'chat-only', provider: 'openai' }],
      defaults: { agent: { model: 'agent-default', provider: 'openai' } },
    };

    expect(
      resolveModelDisplayTargetModel({
        availableModels: [],
        config,
        currentModel: { model: 'chat-only', provider: 'openai' },
        targetScope: 'agent',
      }),
    ).toBeUndefined();
  });
});
