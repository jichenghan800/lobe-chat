// @vitest-environment node
import { readFile } from 'node:fs/promises';

import { eq, inArray, sql } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import { cottiAuditViewLogs, topicCostFreezes, topics, users } from '../../schemas';

const db = await getTestDB();
const owner = 'context-removal-owner';
const other = 'context-removal-other';
const script = await readFile(
  new URL('../../../../../src/_custom/deploy/v2217/disable-context-freezes.sql', import.meta.url),
  'utf8',
);

afterAll(async () => {
  await db
    .delete(cottiAuditViewLogs)
    .where(inArray(cottiAuditViewLogs.targetUserId, [owner, other]));
  await db.delete(users).where(inArray(users.id, [owner, other]));
});

it('releases only context freezes across owners, preserves budget/manual freezes, audits once', async () => {
  await db.insert(users).values([{ id: owner }, { id: other }]);
  await db.insert(topics).values([
    { id: 'remove-context-a', userId: owner },
    { id: 'remove-context-b', userId: other },
    { id: 'keep-budget', userId: owner },
    { id: 'keep-manual', userId: other },
  ]);
  await db.insert(topicCostFreezes).values(
    (
      [
        ['remove-context-a', 'context'],
        ['remove-context-b', 'context'],
        ['keep-budget', 'budget'],
        ['keep-manual', 'manual'],
      ] as const
    ).map(([topicId, reason]) => ({
      topicId,
      reason,
      model: 'test',
      provider: 'test',
      estimatedInputTokens: 200_000,
      inputTokenLimit: 136_000,
    })),
  );
  const result = await db.execute(sql.raw(script));
  expect(Number(result.rows[0].released_context_freezes)).toBe(2);
  const remaining = await db.select().from(topicCostFreezes);
  expect(remaining.map((r) => r.topicId).sort()).toEqual(['keep-budget', 'keep-manual']);
  const audit = await db
    .select()
    .from(cottiAuditViewLogs)
    .where(sql`metadata->>'source'='cotti-budget-only-20260915'`);
  expect(audit).toHaveLength(2);
  expect(audit.map((r) => r.targetUserId).sort()).toEqual([other, owner].sort());
  expect(audit[0].metadata).toMatchObject({ beforeFreeze: { reason: 'context' } });
  expect(Number((await db.execute(sql.raw(script))).rows[0].released_context_freezes)).toBe(0);
  expect(
    await db.select().from(topicCostFreezes).where(eq(topicCostFreezes.topicId, 'keep-budget')),
  ).toHaveLength(1);
});
