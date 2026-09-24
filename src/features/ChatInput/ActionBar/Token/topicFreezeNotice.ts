import type { topicService } from '@/services/topic';

type TopicFreeze = NonNullable<Awaited<ReturnType<typeof topicService.getCostFreeze>>>;

/** Keep reason-specific wording separate from the send gate; unknown history stays neutral. */
export const getTopicFreezeNotice = (freeze?: TopicFreeze | null) => {
  if (freeze?.reason === 'manual') return { key: 'longTopic.frozenManual' as const };
  if (freeze?.reason === 'context') return { key: 'longTopic.frozenContext' as const };
  if (freeze?.reason !== 'budget') return { key: 'longTopic.frozen' as const };
  const spent = freeze.spentCny === null ? NaN : Number(freeze.spentCny);
  const limit = freeze.limitFen;
  if (!Number.isFinite(spent) || spent < 0 || limit === null || limit <= 0)
    return { key: 'longTopic.frozenBudgetUnknown' as const };
  return {
    key: 'longTopic.frozenBudget' as const,
    limit: (limit / 100).toFixed(2),
    spent: spent.toFixed(2),
  };
};
