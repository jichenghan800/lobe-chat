import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadModelsMock = vi.hoisted(() => vi.fn());

vi.mock('@lobechat/business-model-bank/model-config', () => ({
  loadModels: loadModelsMock,
}));

const { getModelPricing } = await import('./getModelPricing');

describe('getModelPricing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadModelsMock.mockResolvedValue([
      {
        id: 'gpt-4o',
        pricing: {
          units: [{ name: 'textInput', rate: 2.5, strategy: 'fixed', unit: 'millionTokens' }],
        },
        providerId: 'openai',
      },
      {
        id: 'gpt-4o',
        pricing: {
          units: [{ name: 'textInput', rate: 3, strategy: 'fixed', unit: 'millionTokens' }],
        },
        providerId: 'other-provider',
      },
    ]);
  });

  it('skips unpriced same-ID entries when falling back to another provider', async () => {
    const pricing = {
      units: [{ name: 'textInput', rate: 4, strategy: 'fixed', unit: 'millionTokens' }],
    };
    loadModelsMock.mockResolvedValue([
      { id: 'shared-model', providerId: 'azure' },
      { id: 'shared-model', providerId: 'other' },
      { id: 'shared-model', providerId: 'openai', pricing },
    ]);
    expect(await getModelPricing('shared-model', 'azure')).toEqual(pricing);
  });

  it('should use injected LobeHub pricing before same-id fallback pricing', async () => {
    loadModelsMock.mockResolvedValue([
      {
        id: 'injected-only-model',
        pricing: {
          units: [{ name: 'textInput', rate: 2.5, strategy: 'fixed', unit: 'millionTokens' }],
        },
        providerId: 'openai',
      },
      {
        id: 'injected-only-model',
        pricing: {
          units: [{ name: 'textInput', rate: 0.5, strategy: 'fixed', unit: 'millionTokens' }],
        },
        providerId: 'lobehub',
      },
    ]);

    const result = await getModelPricing('injected-only-model', 'lobehub');

    expect(result).toEqual({
      units: [{ name: 'textInput', rate: 0.5, strategy: 'fixed', unit: 'millionTokens' }],
    });
  });

  it('should propagate loadModels errors instead of falling back to static defaults', async () => {
    loadModelsMock.mockRejectedValue(new Error('model config missing'));

    await expect(getModelPricing('injected-only-model', 'lobehub')).rejects.toThrow(
      'model config missing',
    );
  });

  it('should use provider pricing when the provider match exists', async () => {
    const result = await getModelPricing('gpt-4o', 'openai');

    expect(result).toEqual({
      units: [{ name: 'textInput', rate: 2.5, strategy: 'fixed', unit: 'millionTokens' }],
    });
  });

  it('should pass explicit pricing context to loadModels', async () => {
    await getModelPricing('gpt-4o', 'openai', { plan: 'premium', scope: 'personal' });

    expect(loadModelsMock).toHaveBeenCalledWith({
      pricingContext: { plan: 'premium', scope: 'personal' },
    });
  });
});

it('prices Vertex Gemini 3.8 generation but lets a native catalog entry take precedence', async () => {
  loadModelsMock.mockResolvedValue([]);
  expect((await getModelPricing('gemini-3.8-flash', 'vertexai'))?.units).toHaveLength(6);
  expect(await getModelPricing('unknown', 'vertexai')).toBeUndefined();
  expect(await getModelPricing('gemini-3.8-flash', 'google')).toBeUndefined();
  const pricing = { units: [] };
  loadModelsMock.mockResolvedValue([{ id: 'gemini-3.8-flash', providerId: 'vertexai', pricing }]);
  expect(await getModelPricing('gemini-3.8-flash', 'vertexai')).toBe(pricing);
});
