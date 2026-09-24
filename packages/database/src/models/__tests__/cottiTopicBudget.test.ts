// @vitest-environment node
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import {
  cottiAuditViewLogs,
  cottiTopicBudgetSettings,
  cottiTopicPolicies,
  cottiUserPolicies,
  messages,
  topicCostFreezes,
  topics,
  users,
} from '../../schemas';
import { CottiTopicBudgetModel } from '../cottiTopicBudget';
import { CottiUserPolicyModel } from '../cottiUserPolicy';
import { TopicCostFreezeModel } from '../topicCostFreeze';
import { recomputeTopicUsage } from '../topicUsage';

const db = await getTestDB();
const budget = new CottiTopicBudgetModel(db);
const freezes = new TopicCostFreezeModel(db, 'budget-owner');
describe('per-topic recorded spending limit', () => {
  beforeEach(async () => {
    await db.insert(users).values([{ id: 'budget-owner' }, { id: 'budget-other' }]);
    await db.insert(topics).values([
      { id: 'budget-topic', userId: 'budget-owner', model: 'terra', provider: 'azure' },
      { id: 'budget-new', userId: 'budget-owner' },
    ]);
  });
  afterEach(async () => {
    await db.delete(users).where(eq(users.id, 'budget-owner'));
    await db.delete(users).where(eq(users.id, 'budget-other'));
    await db.delete(cottiTopicBudgetSettings);
  });
  it('freezes before a request when historical cost plus its estimate reaches the limit', async () => {
    await budget.updateConfig({ enabled: true, limitFen: 1068 }, 'admin');
    await db.insert(messages).values({
      id: 'budget-msg',
      topicId: 'budget-topic',
      userId: 'budget-owner',
      role: 'assistant',
      usage: { cost: 1 },
    });
    await budget.freezeIfExceeded('budget-other', 'budget-topic', 100);
    expect(await freezes.get('budget-topic')).toBeNull();
    await budget.freezeIfExceeded('budget-owner', 'budget-topic', 0.49);
    expect(await freezes.get('budget-topic')).toBeNull();
    await budget.freezeIfExceeded('budget-owner', 'budget-topic', 0.5);
    expect(await freezes.get('budget-topic')).toMatchObject({ reason: 'budget', spentCny: '7.12' });
  });
  it('does not persist a reservation as spending and respects disabled protection', async () => {
    await budget.freezeIfExceeded('budget-owner', 'budget-topic', 0.1);
    await budget.freezeIfExceeded('budget-owner', 'budget-topic', 0.1);
    expect(await freezes.get('budget-topic')).toBeNull();
    await budget.updateConfig({ enabled: false, limitFen: 1000 }, 'admin');
    await budget.freezeIfExceeded('budget-owner', 'budget-topic', 100);
    expect(await freezes.get('budget-topic')).toBeNull();
  });
  it('preserves legacy root metadata costs when a live topic summary is recomputed', async () => {
    await budget.updateConfig({ enabled: false, limitFen: 1000 }, 'admin');
    await db.insert(messages).values([
      {
        id: 'budget-legacy',
        topicId: 'budget-topic',
        userId: 'budget-owner',
        role: 'assistant',
        metadata: { cost: 1 },
      },
      {
        id: 'budget-current',
        topicId: 'budget-topic',
        userId: 'budget-owner',
        role: 'assistant',
        usage: { cost: 2 },
      },
    ]);
    await db.transaction(async (tx) => recomputeTopicUsage(tx, 'budget-owner', 'budget-topic'));
    const [topic] = await db.select().from(topics).where(eq(topics.id, 'budget-topic'));
    expect(topic.cost).toMatchObject({ llm: { total: 3 } });
  });
  it('uses ten yuan by default and freezes only the topic with enough recorded cost', async () => {
    expect(await budget.getConfig()).toEqual({ enabled: true, limitFen: 1000 });
    await db.insert(messages).values({
      id: 'budget-msg',
      topicId: 'budget-topic',
      userId: 'budget-owner',
      role: 'assistant',
      usage: { cost: 1 },
    });
    await budget.freezeIfExceeded('budget-owner', 'budget-topic');
    expect(await freezes.get('budget-topic')).toBeNull();
    await db
      .update(messages)
      .set({ usage: { cost: 2 } })
      .where(eq(messages.id, 'budget-msg'));
    await db.transaction(async (trx) => recomputeTopicUsage(trx, 'budget-owner', 'budget-topic'));
    expect(await freezes.get('budget-topic')).toMatchObject({ reason: 'budget', limitFen: 1000 });
    expect(Number((await freezes.get('budget-topic'))?.spentCny)).toBe(14.24);
    expect(await freezes.get('budget-new')).toBeNull();
  });
  it('honors exact equality, currency conversion, administrator changes and disabled mode', async () => {
    await budget.updateConfig({ enabled: false, limitFen: 712 }, 'admin');
    await db.insert(messages).values({
      id: 'budget-msg',
      topicId: 'budget-topic',
      userId: 'budget-owner',
      role: 'assistant',
      usage: { cost: 1 },
    });
    await budget.freezeIfExceeded('budget-owner', 'budget-topic');
    expect(await freezes.get('budget-topic')).toBeNull();
    await budget.updateConfig({ enabled: true, limitFen: 712 }, 'admin');
    await budget.freezeIfExceeded('budget-owner', 'budget-topic');
    expect(await freezes.get('budget-topic')).toMatchObject({ reason: 'budget', limitFen: 712 });
    await budget.updateConfig({ enabled: false, limitFen: 10000 }, 'admin');
    await budget.freezeIfExceeded('budget-owner', 'budget-topic');
    expect(await freezes.get('budget-topic')).not.toBeNull();
  });
  it('reconciles historical budget freezes after the effective user limit increases', async () => {
    await db.insert(cottiUserPolicies).values({ userId: 'budget-owner', topicLimitFen: 500 });
    await db.insert(messages).values({
      id: 'budget-msg',
      topicId: 'budget-topic',
      userId: 'budget-owner',
      role: 'assistant',
      usage: { cost: 1 },
    });
    await budget.freezeIfExceeded('budget-owner', 'budget-topic');
    expect(await freezes.get('budget-topic')).toMatchObject({ reason: 'budget', limitFen: 500 });
    await db
      .update(cottiUserPolicies)
      .set({ topicLimitFen: 5000 })
      .where(eq(cottiUserPolicies.userId, 'budget-owner'));
    await budget.freezeIfExceeded('budget-owner', 'budget-topic');
    expect(await freezes.get('budget-topic')).toBeNull();
  });
  it('releases an old budget freeze on a platform raise, audits it and still reserves the next call', async () => {
    await db.insert(messages).values({
      id: 'budget-msg',
      topicId: 'budget-topic',
      userId: 'budget-owner',
      role: 'assistant',
      usage: { cost: 1 },
    });
    await budget.freezeIfExceeded('budget-owner', 'budget-topic', 1);
    expect(await freezes.get('budget-topic')).not.toBeNull();
    await budget.updateConfig({ enabled: true, limitFen: 2000 }, 'admin');
    expect(await freezes.get('budget-topic')).toBeNull();
    const audits = await db
      .select()
      .from(cottiAuditViewLogs)
      .where(eq(cottiAuditViewLogs.targetId, 'budget-topic'));
    expect(audits.some((r) => r.metadata?.source === 'cotti-topic-budget-reconciliation')).toBe(
      true,
    );
    await budget.freezeIfExceeded('budget-owner', 'budget-topic', 2);
    expect(await freezes.get('budget-topic')).toMatchObject({ limitFen: 2000 });
  });
  it('keeps manual and context freezes when limits increase', async () => {
    await freezes.freeze('budget-topic', {
      reason: 'manual',
      model: '',
      provider: '',
      estimatedInputTokens: 0,
      inputTokenLimit: 0,
    });
    await freezes.freeze('budget-new', {
      reason: 'context',
      model: '',
      provider: '',
      estimatedInputTokens: 200000,
      inputTokenLimit: 136000,
    });
    await budget.updateConfig({ enabled: true, limitFen: 5000 }, 'admin');
    expect((await freezes.get('budget-topic'))?.reason).toBe('manual');
    expect((await freezes.get('budget-new'))?.reason).toBe('context');
  });
  it('uses effective overrides and does not release a topic still above its new limit', async () => {
    await db.insert(messages).values({
      id: 'budget-msg',
      topicId: 'budget-topic',
      userId: 'budget-owner',
      role: 'assistant',
      usage: { cost: 3 },
    });
    const policies = new CottiUserPolicyModel(db);
    await policies.update('budget-owner', { topicLimitFen: 1000 }, 'admin');
    await budget.freezeIfExceeded('budget-owner', 'budget-topic');
    await budget.updateConfig({ enabled: true, limitFen: 10000 }, 'admin');
    expect(await freezes.get('budget-topic')).not.toBeNull();
    await policies.update('budget-owner', { topicLimitFen: 2000 }, 'admin');
    expect(await freezes.get('budget-topic')).not.toBeNull();
    await db.insert(cottiTopicPolicies).values({ topicId: 'budget-topic', limitFen: 2000 });
    await policies.update('budget-owner', { topicLimitFen: 5000 }, 'admin');
    expect(await freezes.get('budget-topic')).not.toBeNull();
    await db
      .update(cottiTopicPolicies)
      .set({ limitFen: 3000 })
      .where(eq(cottiTopicPolicies.topicId, 'budget-topic'));
    await new TopicCostFreezeModel(db, 'budget-other').get('budget-topic');
    expect(
      await db.query.topicCostFreezes.findFirst({
        where: eq(topicCostFreezes.topicId, 'budget-topic'),
      }),
    ).toBeDefined();
    expect(await freezes.get('budget-topic')).toBeNull();
  });
  it('excludes foreign users, copied transcripts and non-assistant costs without double counting retries', async () => {
    await db.insert(messages).values([
      {
        id: 'budget-msg',
        topicId: 'budget-topic',
        userId: 'budget-owner',
        role: 'assistant',
        usage: { cost: 1 },
        metadata: { usage: { cost: 99 } },
      },
      {
        id: 'budget-copy',
        topicId: 'budget-topic',
        userId: 'budget-owner',
        role: 'assistant',
        usage: { cost: 99 },
        metadata: { copied: true },
      },
      {
        id: 'budget-foreign',
        topicId: 'budget-topic',
        userId: 'budget-other',
        role: 'assistant',
        usage: { cost: 99 },
      },
      {
        id: 'budget-user',
        topicId: 'budget-topic',
        userId: 'budget-owner',
        role: 'user',
        usage: { cost: 99 },
      },
    ]);
    await budget.freezeIfExceeded('budget-other', 'budget-topic');
    await budget.freezeIfExceeded('budget-owner', 'budget-topic');
    await budget.freezeIfExceeded('budget-owner', 'budget-topic');
    expect(await freezes.get('budget-topic')).toBeNull();
  });
});
