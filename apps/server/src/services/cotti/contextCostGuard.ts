import { countContextTokens } from '@lobechat/context-engine';
import {
  AgentRuntimeError,
  getModelPropertyWithFallback,
  type ModelRuntimeHooks,
} from '@lobechat/model-runtime';
import { ChatErrorType, type UIChatMessage } from '@lobechat/types';
import type { Pricing } from 'model-bank';

import { getContextCostPolicy } from '@/_custom/registry/contextCostPolicy';

/** Last check after context engineering. Never exempt cache hits or compression requests. */
export const createContextCostGuard = (provider: string): ModelRuntimeHooks => {
  const check = async (payload: { model: string; messages: unknown[]; tools?: unknown[] }) => {
    const [pricing, capacity] = await Promise.all([
      getModelPropertyWithFallback<Pricing | undefined>(payload.model, 'pricing', provider),
      getModelPropertyWithFallback<number | undefined>(
        payload.model,
        'contextWindowTokens',
        provider,
      ),
    ]);
    const policy = getContextCostPolicy(pricing, capacity);
    // Accounting reads content/tool fields shared by the wire and UI message shapes;
    // it does not require database timestamps or ownership fields.
    const tokens = countContextTokens({
      messages: payload.messages as unknown as UIChatMessage[],
      tools: payload.tools,
    });
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
    beforeGenerateObject: (payload) =>
      check({
        ...payload,
        tools: [...(payload.tools ?? []), ...(payload.schema ? [payload.schema] : [])],
      }),
  };
};
