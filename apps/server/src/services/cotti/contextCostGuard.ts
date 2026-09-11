import { countContextTokens } from '@lobechat/context-engine';
import {
  AgentRuntimeError,
  computeChatCost,
  getModelPricing,
  getModelPropertyWithFallback,
  type ModelRuntimeHooks,
} from '@lobechat/model-runtime';
import { ChatErrorType, type UIChatMessage } from '@lobechat/types';
import type { Pricing } from 'model-bank';

import { getContextCostPolicy } from '@/_custom/registry/contextCostPolicy';
import { CottiTopicBudgetModel } from '@/database/models/cottiTopicBudget';
import { TopicCostFreezeModel } from '@/database/models/topicCostFreeze';
import type { LobeChatDatabase } from '@/database/type';

export const topicFrozenError = () =>
  AgentRuntimeError.createError(ChatErrorType.BadRequest, {
    code: 'TOPIC_COST_FROZEN',
    message: '此话题预算已用完或不足以覆盖下一次调用，已冻结。历史仍可查看，请新建话题。',
  });

export const assertTopicNotCostFrozen = async (
  db: LobeChatDatabase,
  userId: string,
  topicId?: string,
  estimatedNextCostUsd = 0,
) => {
  if (!topicId) return;
  const freezes = new TopicCostFreezeModel(db, userId);
  if (await freezes.get(topicId)) throw topicFrozenError();
  await new CottiTopicBudgetModel(db).freezeIfExceeded(userId, topicId, estimatedNextCostUsd);
  if (await freezes.get(topicId)) throw topicFrozenError();
};

/** Last check after context engineering. Never exempt cache hits or compression requests. */
export const createContextCostGuard = (
  provider: string,
  scope?: { db: LobeChatDatabase; userId: string },
): ModelRuntimeHooks => {
  const check = async (
    payload: { model: string; messages: unknown[]; tools?: unknown[]; max_tokens?: number },
    options?: { metadata?: Record<string, unknown>; tracing?: Record<string, unknown> },
  ) => {
    const topicId = options?.metadata?.topicId ?? options?.tracing?.topicId;
    const scopedTopicId = typeof topicId === 'string' && topicId ? topicId : undefined;
    if (scope) await assertTopicNotCostFrozen(scope.db, scope.userId, scopedTopicId);
    const [pricing, capacity] = await Promise.all([
      getModelPropertyWithFallback<Pricing | undefined>(payload.model, 'pricing', provider),
      getModelPropertyWithFallback<number | undefined>(
        payload.model,
        'contextWindowTokens',
        provider,
      ),
    ]);
    const policy = getContextCostPolicy(pricing, capacity, { id: payload.model, provider });
    // Accounting reads content/tool fields shared by the wire and UI message shapes;
    // it does not require database timestamps or ownership fields.
    const tokens = countContextTokens({
      messages: payload.messages as unknown as UIChatMessage[],
      tools: payload.tools,
    });
    if (scope && scopedTopicId && tokens.adjustedTotal >= policy.freezeTokenLimit) {
      await new TopicCostFreezeModel(scope.db, scope.userId).freeze(scopedTopicId, {
        model: payload.model,
        provider,
        estimatedInputTokens: tokens.rawTotal,
        inputTokenLimit: policy.freezeTokenLimit,
      });
      throw topicFrozenError();
    }
    if (tokens.adjustedTotal > policy.inputTokenLimit) {
      throw AgentRuntimeError.createError(ChatErrorType.BadRequest, {
        code: 'CONTEXT_COST_LIMIT',
        estimatedInputTokens: tokens.rawTotal,
        inputTokenLimit: policy.inputTokenLimit,
        message:
          '本次上下文过大，已停止发送以控制费用。请使用“带着进展继续”或“新问题”，或减少本次资料后重试。',
      });
    }
    if (scope && scopedTopicId) {
      const billingPricing = await getModelPricing(payload.model, provider);
      const estimatedNextCostUsd = estimateTopicRequestCost(
        billingPricing,
        tokens.adjustedTotal,
        payload.max_tokens,
      );
      // No price must not be interpreted as free when monetary protection is enabled.
      if (estimatedNextCostUsd === undefined) {
        if ((await new CottiTopicBudgetModel(scope.db).getConfig()).enabled) {
          throw AgentRuntimeError.createError(ChatErrorType.BadRequest, {
            code: 'TOPIC_BUDGET_PRICE_UNAVAILABLE',
            message: '暂时无法估算此模型费用，请切换模型后重试。',
          });
        }
      } else {
        await assertTopicNotCostFrozen(scope.db, scope.userId, scopedTopicId, estimatedNextCostUsd);
      }
    }
  };
  return {
    beforeChat: check,
    beforeGenerateObject: (payload, options) =>
      check(
        {
          ...payload,
          tools: [...(payload.tools ?? []), ...(payload.schema ? [payload.schema] : [])],
        },
        options,
      ),
  };
};

/** Estimate only: no cache-hit promise, output fallback is not a provider output cap. */
export const estimateTopicRequestCost = (
  pricing: Pricing | undefined,
  inputTokens: number,
  maxOutputTokens?: number,
): number | undefined => {
  if (
    !pricing?.units.some((unit) => unit.name === 'textInput') ||
    !pricing.units.some((unit) => unit.name === 'textOutput')
  )
    return;
  const outputTokens = maxOutputTokens && maxOutputTokens > 0 ? maxOutputTokens : 8192;
  const usage = {
    inputTextTokens: inputTokens,
    inputCacheMissTokens: inputTokens,
    outputTextTokens: outputTokens,
    totalInputTokens: inputTokens,
    totalOutputTokens: outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
  const ordinary = computeChatCost(pricing, usage);
  if (!ordinary || ordinary.issues.length) return;
  if (!pricing.units.some((unit) => unit.name === 'textInput_cacheWrite'))
    return ordinary.totalCost;
  const write = computeChatCost(pricing, {
    ...usage,
    inputCacheMissTokens: 0,
    inputWriteCacheTokens: inputTokens,
  });
  if (!write || write.issues.length) return;
  return Math.max(ordinary.totalCost, write.totalCost);
};
