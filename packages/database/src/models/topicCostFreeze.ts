import { and, eq } from 'drizzle-orm';

import { topicCostFreezes, topics } from '../schemas';
import type { LobeChatDatabase } from '../type';

export class TopicCostFreezeModel {
  constructor(
    private db: LobeChatDatabase,
    private userId: string,
  ) {}

  async get(topicId: string) {
    const [row] = await this.db
      .select({ freeze: topicCostFreezes })
      .from(topics)
      .innerJoin(topicCostFreezes, eq(topics.id, topicCostFreezes.topicId))
      .where(and(eq(topics.id, topicId), eq(topics.userId, this.userId)))
      .limit(1);
    return row?.freeze ?? null;
  }

  async freeze(
    topicId: string,
    values: Omit<typeof topicCostFreezes.$inferInsert, 'topicId' | 'createdAt'>,
  ) {
    const [topic] = await this.db
      .select({ id: topics.id })
      .from(topics)
      .where(and(eq(topics.id, topicId), eq(topics.userId, this.userId)))
      .limit(1);
    if (!topic) throw new Error('Topic not found');
    await this.db
      .insert(topicCostFreezes)
      .values({ ...values, topicId })
      .onConflictDoNothing({ target: topicCostFreezes.topicId });
    return this.get(topicId);
  }
}
