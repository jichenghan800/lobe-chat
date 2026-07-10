import { describe, expect, it, vi } from 'vitest';

import { ModelProvider } from '../../const/modelProvider';
import { loadModels, LOBE_DEFAULT_MODEL_LIST } from '../index';

describe('loadModels', () => {
  it('returns the static model list by default', async () => {
    await expect(loadModels()).resolves.toBe(LOBE_DEFAULT_MODEL_LIST);
  });

  it('overrides provider models with injected async loaders', async () => {
    const loader = vi.fn().mockResolvedValue([
      {
        enabled: true,
        id: 'injected-lobehub-model',
        type: 'chat',
      },
    ]);

    const models = await loadModels({
      providerLoaders: {
        [ModelProvider.LobeHub]: loader,
      },
    });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          enabled: true,
          id: 'injected-lobehub-model',
          providerId: ModelProvider.LobeHub,
          source: 'builtin',
          type: 'chat',
        }),
      ]),
    );
  });

  it('ignores undefined provider loaders', async () => {
    await expect(
      loadModels({
        providerLoaders: {
          [ModelProvider.LobeHub]: undefined,
        },
      }),
    ).resolves.toBe(LOBE_DEFAULT_MODEL_LIST);
  });

  it('propagates injected loader errors without falling back to static models', async () => {
    const loader = vi.fn().mockRejectedValue(new Error('model config missing'));

    await expect(
      loadModels({
        providerLoaders: {
          [ModelProvider.LobeHub]: loader,
        },
      }),
    ).rejects.toThrow('model config missing');
  });
});

describe('knowledgeCutoff backfill', () => {
  it('fills knowledgeCutoff from the canonical map for builtin models', () => {
    const fable = LOBE_DEFAULT_MODEL_LIST.find(
      (m) => m.providerId === 'anthropic' && m.id === 'claude-fable-5',
    );
    expect(fable?.knowledgeCutoff).toBe('2026-01');

    const opus = LOBE_DEFAULT_MODEL_LIST.find(
      (m) => m.providerId === 'anthropic' && m.id === 'claude-opus-4-8',
    );
    expect(opus?.knowledgeCutoff).toBe('2026-01');

    // aggregator spelling of the same model gets the same cutoff
    const bedrockOpus = LOBE_DEFAULT_MODEL_LIST.find(
      (m) => m.providerId === 'bedrock' && m.id === 'global.anthropic.claude-opus-4-7',
    );
    expect(bedrockOpus?.knowledgeCutoff).toBe('2026-01');

    const vertexGemini3Pro = LOBE_DEFAULT_MODEL_LIST.find(
      (m) => m.providerId === 'vertexai' && m.id === 'gemini-3-pro-preview',
    );
    expect(vertexGemini3Pro?.knowledgeCutoff).toBe('2025-01');
  });

  it('keeps an explicit knowledgeCutoff over the map value', async () => {
    const loader = vi.fn().mockResolvedValue([
      { enabled: true, id: 'gpt-5', knowledgeCutoff: '2020-01', type: 'chat' },
      { enabled: true, id: 'gpt-5-mini', type: 'chat' },
    ]);

    const models = await loadModels({
      providerLoaders: { [ModelProvider.LobeHub]: loader },
    });

    const lobehubModels = models.filter((m) => m.providerId === ModelProvider.LobeHub);
    expect(lobehubModels.find((m) => m.id === 'gpt-5')?.knowledgeCutoff).toBe('2020-01');
    expect(lobehubModels.find((m) => m.id === 'gpt-5-mini')?.knowledgeCutoff).toBe('2024-05');
  });
});

describe('Azure GPT-5.6 model cards', () => {
  it.each([
    ['gpt-5.6-sol', 5, 0.5, 6.25, 30],
    ['gpt-5.6-terra', 2.5, 0.25, 3.125, 15],
    ['gpt-5.6-luna', 1, 0.1, 1.25, 6],
  ])(
    'registers %s with exact Foundry deployment and direct OpenAI pricing',
    (id, inputRate, cacheReadRate, cacheWriteRate, outputRate) => {
      const model = LOBE_DEFAULT_MODEL_LIST.find(
        (item) => item.providerId === ModelProvider.Azure && item.id === id,
      );

      expect(model).toMatchObject({
        abilities: {
          functionCall: true,
          reasoning: true,
          search: true,
          structuredOutput: true,
          vision: true,
        },
        config: { deploymentName: id },
        contextWindowTokens: 1_050_000,
        enabled: true,
        generation: 'gpt-5.6',
        knowledgeCutoff: '2026-02',
        maxOutput: 128_000,
        settings: {
          extendParams: ['gpt5_6ReasoningEffort', 'reasoningMode', 'textVerbosity'],
          searchImpl: 'params',
        },
      });

      const getBaseRate = (name: string) => {
        const unit = model?.pricing?.units.find((item) => item.name === name);
        return unit?.strategy === 'tiered' ? unit.tiers[0]?.rate : undefined;
      };

      expect(getBaseRate('textInput')).toBe(inputRate);
      expect(getBaseRate('textInput_cacheRead')).toBe(cacheReadRate);
      expect(getBaseRate('textInput_cacheWrite')).toBe(cacheWriteRate);
      expect(getBaseRate('textOutput')).toBe(outputRate);
    },
  );
});
