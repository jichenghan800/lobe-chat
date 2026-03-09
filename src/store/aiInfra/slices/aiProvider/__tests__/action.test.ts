import * as runtimeModule from '@lobechat/model-runtime';
import { type AIImageModelCard, type EnabledAiModel, type ModelParamsSchema } from 'model-bank';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getChatModelList,
  getImageModelList,
  normalizeChatModel,
  normalizeImageModel,
} from '../action';

const createChatModel = (overrides: Partial<EnabledAiModel> = {}): EnabledAiModel => ({
  abilities: overrides.abilities ?? { functionCall: true },
  contextWindowTokens: overrides.contextWindowTokens ?? 8192,
  displayName: overrides.displayName ?? 'Chat Model',
  enabled: overrides.enabled ?? true,
  id: overrides.id ?? 'chat-model',
  providerId: overrides.providerId ?? 'openai',
  type: 'chat',
  ...overrides,
});

type ImageEnabledModel = EnabledAiModel & AIImageModelCard;

const createImageModel = (overrides: Partial<ImageEnabledModel> = {}): ImageEnabledModel => ({
  abilities: overrides.abilities ?? {},
  contextWindowTokens: overrides.contextWindowTokens,
  displayName: overrides.displayName ?? 'Image Model',
  enabled: overrides.enabled ?? true,
  id: overrides.id ?? 'image-model',
  providerId: overrides.providerId ?? 'openai',
  type: 'image',
  ...overrides,
});

describe('aiProvider action helpers', () => {
  const originalDescriptionRewriteSwitch = process.env.NEXT_PUBLIC_MODEL_ALIAS_DESCRIPTION_REWRITE;

  afterEach(() => {
    if (originalDescriptionRewriteSwitch === undefined) {
      delete process.env.NEXT_PUBLIC_MODEL_ALIAS_DESCRIPTION_REWRITE;
    } else {
      process.env.NEXT_PUBLIC_MODEL_ALIAS_DESCRIPTION_REWRITE = originalDescriptionRewriteSwitch;
    }
    vi.restoreAllMocks();
  });

  describe('normalizeChatModel', () => {
    it('fills missing optional fields with safe defaults', async () => {
      const model = createChatModel({
        abilities: undefined,
        contextWindowTokens: undefined,
        displayName: undefined,
      });

      const result = await normalizeChatModel(model);

      expect(result).toEqual({
        abilities: {},
        contextWindowTokens: undefined,
        displayName: '',
        id: 'chat-model',
      });
    });

    it('replaces built-in model name in description with custom display name', async () => {
      process.env.NEXT_PUBLIC_MODEL_ALIAS_DESCRIPTION_REWRITE = '1';

      vi.spyOn(runtimeModule, 'getModelPropertyWithFallback').mockImplementation(
        async (_id, key) => {
          if (key === 'displayName') return 'Gemini 3.1 Pro Preview';
          if (key === 'description') {
            return 'Gemini 3.1 Pro Preview improves on Gemini 3 Pro with enhanced reasoning capabilities.';
          }
          return undefined;
        },
      );

      const result = await normalizeChatModel(
        createChatModel({
          displayName: 'Cotti-Pro',
          id: 'gemini-3.1-pro-preview',
          providerId: 'vertexai',
        }),
      );

      expect(result.displayName).toBe('Cotti-Pro');
      expect(result.description).toContain('Cotti-Pro improves on Cotti-Pro');
      expect(result.description).not.toContain('Gemini 3.1 Pro Preview');
      expect(result.description).not.toContain('Gemini 3 Pro');
    });

    it('keeps advanced alias replacement disabled when env switch is off', async () => {
      process.env.NEXT_PUBLIC_MODEL_ALIAS_DESCRIPTION_REWRITE = '0';

      vi.spyOn(runtimeModule, 'getModelPropertyWithFallback').mockImplementation(
        async (_id, key) => {
          if (key === 'displayName') return 'Gemini 3.1 Pro Preview';
          if (key === 'description') {
            return 'Gemini 3.1 Pro Preview improves on Gemini 3 Pro with enhanced reasoning capabilities.';
          }
          return undefined;
        },
      );

      const result = await normalizeChatModel(
        createChatModel({
          displayName: 'Cotti-Pro',
          id: 'gemini-3.1-pro-preview',
          providerId: 'vertexai',
        }),
      );

      expect(result.description).toContain('Cotti-Pro improves on Gemini 3 Pro');
      expect(result.description).not.toContain('Gemini 3.1 Pro Preview');
    });

    it('rewrites preview display-name variants in description', async () => {
      process.env.NEXT_PUBLIC_MODEL_ALIAS_DESCRIPTION_REWRITE = '1';

      vi.spyOn(runtimeModule, 'getModelPropertyWithFallback').mockImplementation(
        async (_id, key) => {
          if (key === 'displayName') return 'Gemini 3 Flash Preview';
          if (key === 'description') {
            return 'Gemini 3 Flash is the smartest model built for speed.';
          }
          return undefined;
        },
      );

      const result = await normalizeChatModel(
        createChatModel({
          displayName: 'Cotti-Flash',
          id: 'gemini-3-flash-preview',
          providerId: 'vertexai',
        }),
      );

      expect(result.description).toContain('Cotti-Flash is the smartest model');
      expect(result.description).not.toContain('Gemini 3 Flash');
    });
  });

  describe('normalizeImageModel', () => {
    it('preserves inline metadata and pricing information', async () => {
      const model = createImageModel({
        abilities: { vision: true },
        contextWindowTokens: 4096,
        displayName: 'Inline Model',
        parameters: {
          prompt: { default: '' },
          size: { default: '1024x1024', enum: ['512x512', '1024x1024'] },
        } as ModelParamsSchema,
        pricing: {
          units: [{ name: 'imageGeneration', rate: 0.04, strategy: 'fixed', unit: 'image' }],
        },
      });

      const result = await normalizeImageModel(model);

      expect(result).toMatchObject({
        abilities: { vision: true },
        displayName: 'Inline Model',
        parameters: { size: { default: '1024x1024', enum: ['512x512', '1024x1024'] } },
        pricing: {
          units: [{ name: 'imageGeneration', rate: 0.04, strategy: 'fixed', unit: 'image' }],
        },
      });
    });

    it('fetches fallback description/parameters/pricing when missing', async () => {
      const fallbackSpy = vi
        .spyOn(runtimeModule, 'getModelPropertyWithFallback')
        .mockImplementation(async (_id, key) => {
          if (key === 'parameters')
            return {
              prompt: { default: '' },
              size: { default: '768x768', enum: ['512x512', '768x768'] },
            } satisfies ModelParamsSchema;
          if (key === 'pricing')
            return {
              units: [{ name: 'imageGeneration', rate: 0.02, strategy: 'fixed', unit: 'image' }],
            };
          if (key === 'description') return 'Fallback description';
          return undefined;
        });

      const model = createImageModel({
        id: 'stable-diffusion',
        providerId: 'stability',
        parameters: undefined,
        pricing: undefined,
      });

      const result = await normalizeImageModel(model);

      expect(result.parameters).toEqual({
        prompt: { default: '' },
        size: { default: '768x768', enum: ['512x512', '768x768'] },
      });
      expect(result.pricing).toEqual({
        units: [{ name: 'imageGeneration', rate: 0.02, strategy: 'fixed', unit: 'image' }],
      });
      expect(result.description).toBe('Fallback description');
      expect(fallbackSpy).toHaveBeenCalledWith('stable-diffusion', 'parameters', 'stability');
      expect(fallbackSpy).toHaveBeenCalledWith('stable-diffusion', 'pricing', 'stability');
      expect(fallbackSpy).toHaveBeenCalledWith('stable-diffusion', 'description', 'stability');
    });
  });

  describe('getChatModelList', () => {
    const chatModels = [
      createChatModel({ id: 'gpt-4', providerId: 'openai', displayName: 'GPT-4' }),
      createChatModel({ id: 'gpt-3.5', providerId: 'openai', displayName: 'GPT-3.5' }),
      createChatModel({ id: 'claude-3', providerId: 'anthropic', displayName: 'Claude 3' }),
    ];

    it('filters by provider and deduplicates IDs', async () => {
      const duplicated = [
        ...chatModels,
        createChatModel({ id: 'gpt-4', providerId: 'openai', displayName: 'GPT-4 Duplicate' }),
      ];

      const result = await getChatModelList(duplicated, 'openai');

      expect(result).toHaveLength(2);
      expect(result.map((m) => m.id)).toEqual(['gpt-4', 'gpt-3.5']);
      expect(result[0].displayName).toBe('GPT-4');
    });

    it('returns empty array when provider has no chat models', async () => {
      const result = await getChatModelList(chatModels, 'nonexistent');
      expect(result).toEqual([]);
    });
  });

  describe('getImageModelList', () => {
    const imageModels = [
      createImageModel({ id: 'dall-e-3', providerId: 'openai', displayName: 'DALL-E 3' }),
      createImageModel({ id: 'midjourney', providerId: 'midjourney', displayName: 'Midjourney' }),
    ];

    it('collects normalized image models for a provider', async () => {
      const result = await getImageModelList(imageModels, 'openai');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('dall-e-3');
      expect(result[0].displayName).toBe('DALL-E 3');
    });

    it('returns empty array when provider has no image models', async () => {
      const result = await getImageModelList(imageModels, 'unknown');
      expect(result).toEqual([]);
    });
  });
});
