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

describe('Gemini 3.8 Flash', () => {
  it.each([ModelProvider.Google, ModelProvider.VertexAI])(
    'registers the independent model for %s',
    (providerId) => {
      const model = LOBE_DEFAULT_MODEL_LIST.find(
        (item) => item.providerId === providerId && item.id === 'gemini-3.8-flash',
      );

      expect(model).toMatchObject({
        abilities: {
          functionCall: true,
          reasoning: true,
          search: true,
          vision: true,
        },
        contextWindowTokens: 1_114_112,
        generation: 'gemini-3.8',
        knowledgeCutoff: '2026-03',
        maxOutput: 65_536,
        settings: {
          disabledParams: ['frequency_penalty', 'presence_penalty', 'temperature', 'top_p'],
          extendParams: ['thinkingLevel3', 'urlContext'],
          searchImpl: 'params',
          searchProvider: 'google',
        },
      });
    },
  );
});

describe('ChatGPT subscription models', () => {
  it('advertises reasoning replay support', () => {
    const models = LOBE_DEFAULT_MODEL_LIST.filter(
      (model) => model.providerId === ModelProvider.ChatGPT,
    );

    expect(models).toHaveLength(4);
    expect(
      models.every((model) => model.settings?.extendParams?.includes('preserveThinking')),
    ).toBe(true);
  });
});

describe('Azure OpenAI models', () => {
  it('advertises native search for the GPT-5.6 family', () => {
    const models = LOBE_DEFAULT_MODEL_LIST.filter(
      (model) => model.providerId === ModelProvider.Azure && model.id.startsWith('gpt-5.6-'),
    );

    expect(models.map((model) => model.id)).toEqual([
      'gpt-5.6-sol',
      'gpt-5.6-terra',
      'gpt-5.6-luna',
    ]);
    expect(
      models.every(
        (model) =>
          model.abilities?.search === true &&
          model.settings?.searchImpl === 'params' &&
          model.config?.deploymentName === model.id,
      ),
    ).toBe(true);
  });
});

describe('Moonshot models', () => {
  it('advertises Kimi K3 reasoning effort controls', () => {
    const kimiK3 = LOBE_DEFAULT_MODEL_LIST.find(
      (model) => model.providerId === ModelProvider.Moonshot && model.id === 'kimi-k3',
    );

    expect(kimiK3?.settings?.extendParams).toContain('kimiK3ReasoningEffort');
  });
});

describe('Bailian GLM models', () => {
  it('registers the marketplace-qualified GLM-5.3 model with official reasoning controls', () => {
    const glm53 = LOBE_DEFAULT_MODEL_LIST.find(
      (model) => model.providerId === ModelProvider.Qwen && model.id === 'ZHIPU/GLM-5.3',
    );

    expect(glm53).toEqual(
      expect.objectContaining({
        contextWindowTokens: 1_048_576,
        maxOutput: 131_072,
      }),
    );
    expect(glm53?.abilities).toEqual(
      expect.objectContaining({ functionCall: true, reasoning: true, structuredOutput: true }),
    );
    expect(glm53?.settings?.extendParams).toEqual(['glm5_3ReasoningEffort']);
  });
});

describe('Bailian Qwen models', () => {
  it('registers Qwen3.8 Max with native Responses web search metadata', () => {
    const qwen38Max = LOBE_DEFAULT_MODEL_LIST.find(
      (model) => model.providerId === ModelProvider.Qwen && model.id === 'qwen3.8-max-0902',
    );

    expect(qwen38Max).toEqual(
      expect.objectContaining({
        contextWindowTokens: 1_000_000,
        enabled: true,
        maxOutput: 131_072,
      }),
    );
    expect(qwen38Max?.abilities).toEqual(
      expect.objectContaining({
        functionCall: true,
        reasoning: true,
        search: true,
        structuredOutput: true,
        video: true,
        vision: true,
      }),
    );
    expect(qwen38Max?.settings).toEqual(expect.objectContaining({ searchImpl: 'params' }));
  });
});

describe('Vertex AI Gemini models', () => {
  it('registers Gemini 3.7 Flash alongside Gemini 3.6 Flash with official controls', () => {
    const vertexModels = LOBE_DEFAULT_MODEL_LIST.filter(
      (model) => model.providerId === ModelProvider.VertexAI,
    );
    const gemini36 = vertexModels.find((model) => model.id === 'gemini-3.6-flash');
    const gemini37 = vertexModels.find((model) => model.id === 'gemini-3.7-flash');

    expect(gemini36).toBeDefined();
    expect(gemini37).toEqual(
      expect.objectContaining({
        contextWindowTokens: 1_114_112,
        enabled: true,
        knowledgeCutoff: '2026-03',
        maxOutput: 65_536,
      }),
    );
    expect(gemini37?.abilities).toEqual(
      expect.objectContaining({ functionCall: true, reasoning: true, search: true, vision: true }),
    );
    expect(gemini37?.settings).toEqual(
      expect.objectContaining({
        disabledParams: ['temperature', 'top_p'],
        extendParams: ['thinkingLevel3', 'urlContext'],
      }),
    );
  });
});

describe('Google rolling model aliases', () => {
  it('tracks the current Flash and Flash-Lite model versions', () => {
    const googleModels = LOBE_DEFAULT_MODEL_LIST.filter((model) => model.providerId === 'google');
    const flashLatest = googleModels.find((model) => model.id === 'gemini-flash-latest');
    const flash = googleModels.find((model) => model.id === 'gemini-3.6-flash');
    const flashLiteLatest = googleModels.find((model) => model.id === 'gemini-flash-lite-latest');
    const flashLite = googleModels.find((model) => model.id === 'gemini-3.5-flash-lite');

    expect(flashLatest).toEqual(
      expect.objectContaining({
        description: 'Points to gemini-3.6-flash',
        knowledgeCutoff: '2026-03',
      }),
    );
    expect(flashLatest?.pricing).toEqual(flash?.pricing);
    expect(flashLatest?.settings?.disabledParams).toEqual(['temperature', 'top_p']);

    expect(flashLiteLatest).toEqual(
      expect.objectContaining({
        description: 'Points to gemini-3.5-flash-lite',
        knowledgeCutoff: '2026-03',
      }),
    );
    expect(flashLiteLatest?.pricing).toEqual(flashLite?.pricing);
    expect(flashLiteLatest?.settings?.disabledParams).toEqual(['temperature', 'top_p']);
  });
});

describe('Gemini native image models', () => {
  it.each([ModelProvider.Google, ModelProvider.VertexAI])(
    'exposes the generally available Nano Banana 2 model for %s',
    (providerId) => {
      const providerModels = LOBE_DEFAULT_MODEL_LIST.filter(
        (model) => model.providerId === providerId,
      );

      expect(providerModels).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'gemini-3.1-flash-image',
            releasedAt: '2026-05-28',
          }),
        ]),
      );
      expect(providerModels.some((model) => model.id === 'gemini-3.1-flash-image-preview')).toBe(
        false,
      );
    },
  );
});
