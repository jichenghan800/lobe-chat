import type { GenerateContentResponseUsageMetadata } from '@google/genai';
import { MediaModality } from '@google/genai';
import type { Pricing } from 'model-bank';
import vertexModels from 'model-bank/vertexai';
import { describe, expect, it } from 'vitest';

import { cottiGemini38Pricing } from '../../utils/cottiGeminiPricing';
import { convertGoogleAIUsage } from './google-ai';

describe('convertGoogleAIUsage', () => {
  it('should convert usage details with text and image breakdown', () => {
    const usage: GenerateContentResponseUsageMetadata = {
      cachedContentTokenCount: 6,
      candidatesTokenCount: 40,
      candidatesTokensDetails: [
        { modality: MediaModality.TEXT, tokenCount: 30 },
        { modality: MediaModality.IMAGE, tokenCount: 10 },
      ],
      cacheTokensDetails: [
        { modality: MediaModality.TEXT, tokenCount: 4 },
        { modality: MediaModality.VIDEO, tokenCount: 2 },
      ],
      promptTokenCount: 70,
      promptTokensDetails: [
        { modality: MediaModality.TEXT, tokenCount: 60 },
        { modality: MediaModality.IMAGE, tokenCount: 5 },
        { modality: MediaModality.VIDEO, tokenCount: 4 },
      ],
      thoughtsTokenCount: 12,
      totalTokenCount: 122,
    };

    const result = convertGoogleAIUsage(usage);

    expect(result).toEqual({
      inputAudioTokens: undefined,
      inputCachedAudioTokens: undefined,
      inputCachedImageTokens: undefined,
      inputCachedTextTokens: 4,
      inputCacheMissTokens: 64,
      inputCachedTokens: 6,
      inputCachedVideoTokens: 2,
      inputImageTokens: 5,
      inputTextTokens: 60,
      inputVideoTokens: 4,
      outputImageTokens: 10,
      outputReasoningTokens: 12,
      outputTextTokens: 30,
      totalInputTokens: 70,
      totalOutputTokens: 52,
      totalTokens: 122,
    });
  });

  it('should fall back to total tokens when text modality missing', () => {
    const usage: GenerateContentResponseUsageMetadata = {
      cachedContentTokenCount: undefined,
      candidatesTokenCount: 55,
      candidatesTokensDetails: [{ modality: MediaModality.IMAGE, tokenCount: 15 }],
      promptTokenCount: 40,
      promptTokensDetails: [{ modality: MediaModality.IMAGE, tokenCount: 3 }],
      thoughtsTokenCount: 5,
      totalTokenCount: 100,
    };

    const result = convertGoogleAIUsage(usage);

    expect(result).toEqual({
      inputAudioTokens: undefined,
      inputCachedAudioTokens: undefined,
      inputCachedImageTokens: undefined,
      inputCachedTextTokens: undefined,
      inputCacheMissTokens: undefined,
      inputCachedTokens: undefined,
      inputCachedVideoTokens: undefined,
      inputImageTokens: 3,
      inputTextTokens: undefined,
      inputVideoTokens: undefined,
      outputImageTokens: 15,
      outputReasoningTokens: 5,
      outputTextTokens: 40,
      totalInputTokens: 40,
      totalOutputTokens: 60,
      totalTokens: 100,
    });
  });

  it('should calculate cache miss tokens when cached content token count is zero', () => {
    const usage: GenerateContentResponseUsageMetadata = {
      cachedContentTokenCount: 0,
      candidatesTokenCount: 217,
      candidatesTokensDetails: undefined,
      promptTokenCount: 5491,
      promptTokensDetails: undefined,
      thoughtsTokenCount: 0,
      toolUsePromptTokenCount: 0,
      toolUsePromptTokensDetails: undefined,
      totalTokenCount: 6973,
    };

    const pricing: Pricing = {
      units: [
        { name: 'textInput', rate: 1, strategy: 'fixed', unit: 'millionTokens' },
        { name: 'textInput_cacheRead', rate: 0.25, strategy: 'fixed', unit: 'millionTokens' },
        { name: 'textOutput', rate: 2, strategy: 'fixed', unit: 'millionTokens' },
      ],
    };

    const result = convertGoogleAIUsage(usage, pricing);

    expect(result.inputCacheMissTokens).toBe(5491);
    expect(result.inputCachedTokens).toBe(0);
    expect(result.totalInputTokens).toBe(5491);
    expect(result.cost).toBeCloseTo((5491 + 217 * 2) / 1_000_000, 10);
  });

  it('should attach cost when pricing provided', () => {
    const usage: GenerateContentResponseUsageMetadata = {
      candidatesTokenCount: 100_000,
      promptTokenCount: 200_000,
      totalTokenCount: 300_000,
    };

    const pricing: Pricing = {
      units: [
        { name: 'textInput', rate: 1, strategy: 'fixed', unit: 'millionTokens' },
        { name: 'textOutput', rate: 2, strategy: 'fixed', unit: 'millionTokens' },
      ],
    };

    const result = convertGoogleAIUsage(usage, pricing);

    expect(result.cost).toBeCloseTo(0.4, 10);
  });

  it('should handle toolUsePromptTokenCount (e.g. grounding/search tool return tokens)', () => {
    const usage: GenerateContentResponseUsageMetadata = {
      candidatesTokenCount: 367,
      promptTokenCount: 50,
      toolUsePromptTokenCount: 7596,
      totalTokenCount: 8013,
    };

    const result = convertGoogleAIUsage(usage);

    expect(result).toEqual({
      inputAudioTokens: undefined,
      inputCachedAudioTokens: undefined,
      inputCachedImageTokens: undefined,
      inputCachedTextTokens: undefined,
      inputCacheMissTokens: undefined,
      inputCachedTokens: undefined,
      inputCachedVideoTokens: undefined,
      inputImageTokens: undefined,
      inputTextTokens: undefined,
      inputToolTokens: 7596,
      inputVideoTokens: undefined,
      outputImageTokens: 0,
      outputReasoningTokens: undefined,
      outputTextTokens: 367,
      totalInputTokens: 7646, // promptTokenCount (50) + toolUsePromptTokenCount (7596)
      totalOutputTokens: 367,
      totalTokens: 8013,
    });
  });

  it('should not set inputToolTokens when toolUsePromptTokenCount is absent', () => {
    const usage: GenerateContentResponseUsageMetadata = {
      candidatesTokenCount: 367,
      promptTokenCount: 7646,
      totalTokenCount: 8013,
    };

    const result = convertGoogleAIUsage(usage);

    expect(result.inputToolTokens).toBeUndefined();
    expect(result.totalInputTokens).toBe(7646);
  });
});

describe('Gemini recorded price verification', () => {
  it.each([
    ['gemini-3.5-flash-lite', 0.3, 0.03, 2.5],
    ['gemini-3.5-flash', 1.5, 0.15, 9],
    ['gemini-3.6-flash', 1.5, 0.15, 7.5],
    ['gemini-3.7-flash', 1.5, 0.15, 7.5],
    ['gemini-3.8-flash', 1.5, 0.15, 7.5],
  ] as const)(
    '%s discounts cache hits and bills reasoning output once',
    (id, input, cache, output) => {
      const pricing =
        id === 'gemini-3.8-flash'
          ? cottiGemini38Pricing
          : vertexModels.find((m) => m.id === id)?.pricing;
      expect(pricing).toBeDefined();
      const usage = convertGoogleAIUsage(
        {
          promptTokenCount: 100000,
          cachedContentTokenCount: 80000,
          candidatesTokenCount: 1000,
          thoughtsTokenCount: 2000,
          totalTokenCount: 103000,
        },
        pricing,
      );
      expect(usage.cost).toBeCloseTo((20000 * input + 80000 * cache + 3000 * output) / 1000000, 6);
      expect(usage.totalOutputTokens).toBe(3000);
    },
  );
});
