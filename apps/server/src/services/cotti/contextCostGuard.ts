import { countContextTokens } from '@lobechat/context-engine';
import {
  AgentRuntimeError,
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
    message: '此话题已达到成本保护限额并冻结，不能继续发送或执行任务。历史仍可查看，请新建话题。',
  });

export const assertTopicNotCostFrozen = async (
  db: LobeChatDatabase,
  userId: string,
  topicId?: string,
) => {
  if (!topicId) return;
  const freezes = new TopicCostFreezeModel(db, userId);
  if (await freezes.get(topicId)) throw topicFrozenError();
  await new CottiTopicBudgetModel(db).freezeIfExceeded(userId, topicId);
  if (await freezes.get(topicId)) throw topicFrozenError();
};

/** Last check after context engineering. Never exempt cache hits or compression requests. */
export const createContextCostGuard = (
  provider: string,
  scope?: { db: LobeChatDatabase; userId: string },
): ModelRuntimeHooks => {
  const check = async (
    payload: { model: string; messages: unknown[]; tools?: unknown[] },
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
