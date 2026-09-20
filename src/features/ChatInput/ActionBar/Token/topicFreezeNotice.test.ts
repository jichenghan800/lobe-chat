import { describe, expect, it } from 'vitest';

import type { topicService } from '@/services/topic';

import { getTopicFreezeNotice } from './topicFreezeNotice';

const freeze: NonNullable<Awaited<ReturnType<typeof topicService.getCostFreeze>>> = {
  topicId: 'topic',
  reason: 'budget',
  spentCny: '9.1234',
  limitFen: 1000,
  model: 'model',
  provider: 'provider',
  estimatedInputTokens: 0,
  inputTokenLimit: 0,
  createdAt: new Date(),
};

describe('topic freeze notice', () => {
  it('explains insufficient next-call budget even below the limit, with CNY amounts', () => {
    expect(getTopicFreezeNotice(freeze)).toEqual({
      key: 'longTopic.frozenBudget',
      spent: '9.12',
      limit: '10.00',
    });
  });
  it('preserves a recorded zero cost', () => {
    expect(getTopicFreezeNotice({ ...freeze, spentCny: '0' }).spent).toBe('0.00');
  });
  it.each([
    { spentCny: null },
    { spentCny: 'invalid' },
    { spentCny: '-1' },
    { limitFen: null },
    { limitFen: 0 },
  ])('does not invent missing or invalid amounts: %j', (patch) => {
    expect(getTopicFreezeNotice({ ...freeze, ...patch })).toEqual({
      key: 'longTopic.frozenBudgetUnknown',
    });
  });
  it('does not blame cost for manual or historical context freezes', () => {
    expect(getTopicFreezeNotice({ ...freeze, reason: 'manual' }).key).toBe(
      'longTopic.frozenManual',
    );
    expect(getTopicFreezeNotice({ ...freeze, reason: 'context' }).key).toBe(
      'longTopic.frozenContext',
    );
  });
  it('keeps unknown or unloaded records neutral', () => {
    expect(getTopicFreezeNotice()).toEqual({ key: 'longTopic.frozen' });
    expect(getTopicFreezeNotice(null)).toEqual({ key: 'longTopic.frozen' });
  });
});
