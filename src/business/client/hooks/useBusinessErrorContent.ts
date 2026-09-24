import type { ChatMessageError } from '@lobechat/types';
import { isRecord } from '@lobechat/utils/object';

export interface BusinessErrorContentResult {
  errorType?: string;
  hideMessage?: boolean;
  message?: string;
}

export default function useBusinessErrorContent(
  error?: ChatMessageError | null,
): BusinessErrorContentResult {
  const detail = isRecord(error?.body) ? error.body.error : undefined;
  if (
    isRecord(detail) &&
    typeof detail.code === 'string' &&
    ['TOPIC_COST_FROZEN', 'CONTEXT_COST_LIMIT', 'TOPIC_BUDGET_PRICE_UNAVAILABLE'].includes(
      detail.code,
    ) &&
    typeof detail.message === 'string' &&
    detail.message.trim()
  ) {
    return { message: detail.message };
  }
  return {};
}
