import { and, eq, sql } from 'drizzle-orm';

import {
  cottiTopicBudgetSettings,
  cottiTopicPolicies,
  messages,
  topicCostFreezes,
  topics,
} from '../schemas';
import type { LobeChatDatabase, Transaction } from '../type';
import { notCopiedTranscript } from '../utils/copiedTranscript';
import { CottiUserPolicyModel } from './cottiUserPolicy';

/** Same fixed display conversion as the topic cost footer; excludes promotional credits. */
export const TOPIC_BUDGET_USD_TO_CNY = 7.12;

export class CottiTopicBudgetModel {
  constructor(private db: LobeChatDatabase | Transaction) {}

  async getConfig() {
    const [row] = await this.db
      .select()
      .from(cottiTopicBudgetSettings)
      .where(eq(cottiTopicBudgetSettings.id, 'default'))
      .limit(1);
    return { enabled: row?.enabled ?? true, limitFen: row?.limitFen ?? 1000 };
  }

  async updateConfig(config: { enabled: boolean; limitFen: number }, updatedBy: string) {
    await this.db
      .insert(cottiTopicBudgetSettings)
      .values({ id: 'default', ...config, updatedBy })
      .onConflictDoUpdate({
        target: cottiTopicBudgetSettings.id,
        set: { ...config, updatedBy, updatedAt: new Date() },
      });
    return this.getConfig();
  }

  /** Re-read persisted costs: retries overwrite usage, so they are never added twice. */
  async freezeIfExceeded(userId: string, topicId: string, estimatedNextCostUsd = 0) {
    if (!Number.isFinite(estimatedNextCostUsd) || estimatedNextCostUsd < 0) {
      throw new Error('Invalid topic budget estimate');
    }
    const config = await this.getConfig();
    if (!config.enabled) return;
    const userPolicy = await new CottiUserPolicyModel(this.db).get(userId);
    const [topicPolicy] = await this.db
      .select()
      .from(cottiTopicPolicies)
      .where(eq(cottiTopicPolicies.topicId, topicId))
      .limit(1);
    const limitFen = topicPolicy?.limitFen ?? userPolicy.topicLimitFen ?? config.limitFen;
    const [topic] = await this.db
      .select({ id: topics.id, model: topics.model, provider: topics.provider })
      .from(topics)
      .where(and(eq(topics.id, topicId), eq(topics.userId, userId)))
      .limit(1);
    if (!topic) return;
    const raw = sql`coalesce(${messages.usage}->>'cost', ${messages.metadata}->'usage'->>'cost', ${messages.metadata}->>'cost')`;
    const cost = sql`case when ${raw} ~ '^[0-9]+([.][0-9]+)?$' then (${raw})::numeric end`;
    const [summary] = await this.db
      .select({
        spentCny: sql<string>`coalesce(sum(${cost}), 0) * ${TOPIC_BUDGET_USD_TO_CNY}::numeric`,
        exceeded: sql<boolean>`(coalesce(sum(${cost}), 0) + ${estimatedNextCostUsd}::numeric) * ${TOPIC_BUDGET_USD_TO_CNY}::numeric * 100 >= ${limitFen}`,
      })
      .from(messages)
      .where(
        and(
          eq(messages.topicId, topicId),
          eq(messages.userId, userId),
          eq(messages.role, 'assistant'),
          notCopiedTranscript(),
        ),
      );
    if (!summary?.exceeded) return;
    await this.db
      .insert(topicCostFreezes)
      .values({
        topicId,
        reason: 'budget',
        spentCny: String(summary.spentCny),
        limitFen,
        model: topic.model ?? '',
        provider: topic.provider ?? '',
        estimatedInputTokens: 0,
        inputTokenLimit: 0,
      })
      .onConflictDoNothing({ target: topicCostFreezes.topicId });
  }
}
