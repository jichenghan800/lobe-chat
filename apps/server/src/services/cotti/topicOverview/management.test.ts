// @vitest-environment node
import {
  cottiAuditViewLogs,
  cottiTopicPolicies,
  messages,
  topicCostFreezes,
  topics,
  users,
} from '@lobechat/database/schemas';
import { getTestDB } from '@lobechat/database/test-utils';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CottiTopicBudgetModel } from '@/database/models/cottiTopicBudget';
import type { LobeChatDatabase } from '@/database/type';

import { CottiTopicOverviewService } from './index';
import { CottiTopicManagementService } from './management';

describe('administrator topic budget controls', () => {
  let db: LobeChatDatabase;
  let service: CottiTopicManagementService;
  const prefix = `manage-${Date.now()}`;
  const owner = `${prefix}-owner`;
  const admin = `${prefix}-admin`;
  const id = `${prefix}-topic`;
  beforeAll(async () => {
    db = await getTestDB();
    service = new CottiTopicManagementService(db);
    await db.insert(users).values([{ id: owner }, { id: admin }]);
    await db.insert(topics).values([
      { id, userId: owner, title: prefix, cost: { llm: { total: 2 } } },
      { id: `${id}-other`, userId: owner, title: prefix, cost: { llm: { total: 1 } } },
    ]);
    await db.insert(messages).values([
      {
        id: `${prefix}-m`,
        topicId: id,
        userId: owner,
        role: 'assistant',
        model: 'terra',
        provider: 'azure',
        usage: { cost: 2, totalInputTokens: 1000, totalOutputTokens: 20 },
      },
      {
        id: `${prefix}-copied`,
        topicId: id,
        userId: owner,
        role: 'assistant',
        usage: { cost: 90 },
        metadata: { copied: true },
      },
      {
        id: `${prefix}-foreign`,
        topicId: id,
        userId: admin,
        role: 'assistant',
        usage: { cost: 80 },
      },
    ]);
  }, 60000);
  afterAll(async () => {
    await db.delete(cottiAuditViewLogs).where(eq(cottiAuditViewLogs.adminUserId, admin));
    await db.delete(users).where(inArray(users.id, [owner, admin]));
  });
  it('uses actual model costs, excluding copied and foreign messages', async () => {
    const state = await service.get(id);
    expect(state.costUsd).toBe(2);
    expect(state.models).toHaveLength(1);
    expect(state.models[0]).toMatchObject({ model: 'terra', inputTokens: 1000, outputTokens: 20 });
  });
  it('sorts by model cost before pagination and filters frozen topics', async () => {
    const overview = new CottiTopicOverviewService(db);
    expect((await overview.list({ q: prefix })).items.map((row) => row.id)).toEqual([
      id,
      `${id}-other`,
    ]);
    await service.update({ topicId: id, action: 'freeze' }, admin);
    expect((await overview.list({ q: prefix })).items.map((row) => row.id)).toEqual([
      `${id}-other`,
    ]);
    expect(
      (await overview.list({ q: prefix, status: 'frozen' })).items.map((row) => row.id),
    ).toEqual([id]);
    expect((await overview.list({ q: prefix, status: 'all' })).total).toBe(2);
  });
  it('atomically raises this topic limit and unfreezes without changing other topics', async () => {
    await expect(service.update({ topicId: id, action: 'unfreeze' }, admin)).rejects.toThrow(
      '额度',
    );
    const state = await service.update(
      { topicId: id, action: 'setLimitAndUnfreeze', limitFen: 3000 },
      admin,
    );
    expect(state).toMatchObject({ limitFen: 3000, limitSource: 'topic', freeze: null });
    expect((await service.get(`${id}-other`)).limitFen).toBe(1000);
    await new CottiTopicBudgetModel(db).freezeIfExceeded(owner, id);
    expect((await service.get(id)).freeze).toBeNull();
    await new CottiTopicBudgetModel(db).freezeIfExceeded(owner, id, 3);
    expect((await service.get(id)).freeze?.reason).toBe('budget');
  });
  it('does not treat a budget increase as context-limit approval and rolls back on failure', async () => {
    await db
      .update(topicCostFreezes)
      .set({ reason: 'context' })
      .where(eq(topicCostFreezes.topicId, id));
    await expect(
      service.update({ topicId: id, action: 'setLimitAndUnfreeze', limitFen: 4000 }, admin),
    ).rejects.toThrow('上下文');
    expect((await service.get(id)).topicLimitFen).toBe(3000);
    await service.update({ topicId: id, action: 'unfreeze' }, admin);
    expect((await service.get(id)).freeze).toBeNull();
    await service.update({ topicId: id, action: 'setLimit', limitFen: null }, admin);
    expect((await service.get(id)).limitSource).toBe('platform');
    const audit = await db
      .select()
      .from(cottiAuditViewLogs)
      .where(eq(cottiAuditViewLogs.adminUserId, admin));
    expect(audit.length).toBeGreaterThanOrEqual(4);
    expect(
      (
        await db
          .select()
          .from(cottiTopicPolicies)
          .where(eq(cottiTopicPolicies.topicId, `${id}-other`))
      ).length,
    ).toBe(0);
  });
  it('keeps expensive old topics on the first page ahead of newer cheap topics', async () => {
    await db.insert(topics).values(
      Array.from({ length: 22 }, (_, i) => ({
        id: `${prefix}-filler-${i}`,
        userId: owner,
        title: prefix,
        cost: { llm: { total: 0.01 } },
        updatedAt: new Date(Date.now() + 10000),
      })),
    );
    const first = await new CottiTopicOverviewService(db).list({
      q: prefix,
      status: 'all',
      pageSize: 20,
    });
    expect(first.items[0].id).toBe(id);
    expect(first.items[1].id).toBe(`${id}-other`);
    expect(first.total).toBe(24);
  });
});
