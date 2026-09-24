import type { LobeAgentChatConfig } from '@lobechat/types';
import azureModels from 'model-bank/azure';
import openaiModels from 'model-bank/openai';
import { describe, expect, it } from 'vitest';

import { computeChatCost } from '../../core/usageConverters/utils/computeChatCost';
import { applyModelExtendParams } from '../../utils/modelExtendParams';
import { isOpenAIReasoningPayloadModel, isResponsesAPIModel } from './modelId';

describe.each([
  ['openai', openaiModels],
  ['azure', azureModels],
] as const)('GPT-6 Sol through %s', (_provider, models) => {
  const entry = models.find((item) => item.id === 'gpt-6-sol');
  const model = entry?.type === 'chat' ? entry : undefined;

  it('resolves a tool-capable model on the Responses route', () => {
    expect(model).toBeDefined();
    expect(model?.abilities?.functionCall).toBe(true);
    expect(isResponsesAPIModel(model!.id)).toBe(true);
    expect(isOpenAIReasoningPayloadModel(model!.id)).toBe(true);
  });

  it.each(['none', 'low', 'medium', 'high', 'xhigh', 'max'] as const)(
    'preserves selected reasoning effort %s using registered model settings',
    (effort) => {
      expect(model).toBeDefined();
      const result = applyModelExtendParams({
        chatConfig: { gpt5_6ReasoningEffort: effort } as LobeAgentChatConfig,
        extendParams: model!.settings?.extendParams,
        model: model!.id,
      });
      expect(result.reasoning_effort).toBe(effort);
    },
  );

  it.each([
    [200_000, 50_000, 0.37],
    [272_000, 122_000, 0.514],
    [272_001, 122_001, 1.023004],
    [300_000, 150_000, 1.135],
  ])(
    'bills all token categories at the whole-request tier for %d input tokens',
    (totalInputTokens, inputCacheMissTokens, expected) => {
      expect(model?.pricing).toBeDefined();
      const result = computeChatCost(model!.pricing, {
        totalInputTokens,
        inputCacheMissTokens,
        inputCachedTokens: 50_000,
        inputWriteCacheTokens: 100_000,
        outputTextTokens: 1000,
      });
      expect(result?.totalCost).toBeCloseTo(expected, 6);
    },
  );
});
