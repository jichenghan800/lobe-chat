import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';

import { CottiTopicBudgetModel, TOPIC_BUDGET_USD_TO_CNY } from '@/database/models/cottiTopicBudget';
import { CottiUserPolicyModel } from '@/database/models/cottiUserPolicy';
import {
  cottiAuditViewLogs,
  cottiTopicPolicies,
  topicCostFreezes,
  topics,
} from '@/database/schemas';
import type { LobeChatDatabase, Transaction } from '@/database/type';
import type { CottiTopicManagementInput } from '@/types/cotti/topicOverview';

/** Same persisted cost sources and ownership as the request budget guard. */
const usageNumber = (field: string) => {
  const raw = sql`coalesce(usage->>${field}, metadata->'usage'->>${field}, metadata->>${field})`;
  return sql`case when ${raw} ~ '^[0-9]+([.][0-9]+)?$' then (${raw})::numeric end`;
};

export const getTopicAccounting = async (
  db: LobeChatDatabase | Transaction,
  topicId: string,
  userId: string,
) => {
  const result = await db.execute(sql`
    SELECT model, provider, count(*)::int AS records,
      count(${usageNumber('cost')})::int AS "pricedRecords",
      sum(${usageNumber('cost')}) AS "costUsd",
      coalesce(sum(${usageNumber('totalInputTokens')}),0) AS "inputTokens",
      coalesce(sum(${usageNumber('totalOutputTokens')}),0) AS "outputTokens",
      coalesce(sum(${usageNumber('inputCachedTokens')}),0) AS "cachedTokens",
      coalesce(sum(${usageNumber('inputWriteCacheTokens')}),0) AS "cacheWriteTokens"
    FROM messages WHERE topic_id=${topicId} AND user_id=${userId} AND role='assistant'
      AND coalesce(metadata->>'copied','') <> 'true'
    GROUP BY model, provider ORDER BY sum(${usageNumber('cost')}) DESC NULLS LAST
  `);
  return result.rows.map((row) => ({
    model: String(row.model ?? ''),
    provider: String(row.provider ?? ''),
    records: Number(row.records),
    pricedRecords: Number(row.pricedRecords),
    costUsd: row.costUsd == null ? null : Number(row.costUsd),
    inputTokens: Number(row.inputTokens),
    outputTokens: Number(row.outputTokens),
    cachedTokens: Number(row.cachedTokens),
    cacheWriteTokens: Number(row.cacheWriteTokens),
  }));
};

export class CottiTopicManagementService {
  constructor(private db: LobeChatDatabase) {}

  async get(topicId: string) {
    const [topic] = await this.db.select().from(topics).where(eq(topics.id, topicId)).limit(1);
    if (!topic) throw new TRPCError({ code: 'NOT_FOUND' });
    const [models, config, userPolicy, overrides, freezes] = await Promise.all([
      getTopicAccounting(this.db, topicId, topic.userId),
      new CottiTopicBudgetModel(this.db).getConfig(),
      new CottiUserPolicyModel(this.db).get(topic.userId),
      this.db.select().from(cottiTopicPolicies).where(eq(cottiTopicPolicies.topicId, topicId)),
      this.db.select().from(topicCostFreezes).where(eq(topicCostFreezes.topicId, topicId)),
    ]);
    const limitFen = overrides[0]?.limitFen ?? userPolicy.topicLimitFen ?? config.limitFen;
    return {
      models,
      enabled: config.enabled,
      limitFen,
      topicLimitFen: overrides[0]?.limitFen ?? null,
      limitSource:
        overrides[0]?.limitFen != null
          ? ('topic' as const)
          : userPolicy.topicLimitFen != null
            ? ('user' as const)
            : ('platform' as const),
      freeze: freezes[0] ? { ...freezes[0], createdAt: freezes[0].createdAt.toISOString() } : null,
      costUsd: models.reduce((sum, model) => sum + (model.costUsd ?? 0), 0),
      costComplete: models.every((model) => model.records === model.pricedRecords),
    };
  }

  async update(input: CottiTopicManagementInput, adminUserId: string, adminEmail?: string | null) {
    await this.db.transaction(async (tx) => {
      const locked = await tx.execute(
        sql`SELECT id,user_id FROM topics WHERE id=${input.topicId} FOR UPDATE`,
      );
      if (!locked.rows.length) throw new TRPCError({ code: 'NOT_FOUND' });
      const userId = String(locked.rows[0].user_id);
      const [beforePolicy] = await tx
        .select()
        .from(cottiTopicPolicies)
        .where(eq(cottiTopicPolicies.topicId, input.topicId));
      const [beforeFreeze] = await tx
        .select()
        .from(topicCostFreezes)
        .where(eq(topicCostFreezes.topicId, input.topicId));
      if (input.action === 'setLimit' || input.action === 'setLimitAndUnfreeze') {
        await tx
          .insert(cottiTopicPolicies)
          .values({
            topicId: input.topicId,
            limitFen: input.limitFen ?? null,
            updatedBy: adminUserId,
          })
          .onConflictDoUpdate({
            target: cottiTopicPolicies.topicId,
            set: {
              limitFen: input.limitFen ?? null,
              updatedBy: adminUserId,
              updatedAt: new Date(),
            },
          });
      }
      if (input.action === 'unfreeze' || input.action === 'setLimitAndUnfreeze') {
        if (input.action === 'setLimitAndUnfreeze' && beforeFreeze?.reason === 'context') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: '上下文冻结不能通过提高金额额度解除，请单独确认解冻。',
          });
        }
        const config = await new CottiTopicBudgetModel(tx).getConfig();
        const userPolicy = await new CottiUserPolicyModel(tx).get(userId);
        const [policy] = await tx
          .select()
          .from(cottiTopicPolicies)
          .where(eq(cottiTopicPolicies.topicId, input.topicId));
        const models = await getTopicAccounting(tx, input.topicId, userId);
        const spent = models.reduce((sum, m) => sum + (m.costUsd ?? 0), 0);
        if (
          config.enabled &&
          spent * TOPIC_BUDGET_USD_TO_CNY * 100 >=
            (policy?.limitFen ?? userPolicy.topicLimitFen ?? config.limitFen)
        ) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: '当前累计费用已达到有效额度，请先提高本话题总额度。',
          });
        }
        await tx.delete(topicCostFreezes).where(eq(topicCostFreezes.topicId, input.topicId));
      }
      if (input.action === 'freeze') {
        await tx
          .insert(topicCostFreezes)
          .values({
            topicId: input.topicId,
            reason: 'manual',
            model: '',
            provider: '',
            estimatedInputTokens: 0,
            inputTokenLimit: 0,
          })
          .onConflictDoNothing();
      }
      await tx.insert(cottiAuditViewLogs).values({
        adminUserId,
        adminEmail: adminEmail ?? null,
        targetId: input.topicId,
        targetType: 'topic',
        targetUserId: userId,
        metadata: {
          source: 'cotti-topic-management',
          action: input.action,
          beforePolicy: beforePolicy ?? null,
          beforeFreeze: beforeFreeze ?? null,
          limitFen: input.limitFen ?? null,
        },
      });
    });
    return this.get(input.topicId);
  }
}
