import { integer, numeric, pgTable, text } from 'drizzle-orm/pg-core';

import { createdAt } from './_helpers';
import { topics } from './topic';

/** Server-owned, permanent cost gate. Normal topic updates cannot clear this row. */
export const topicCostFreezes = pgTable('topic_cost_freezes', {
  topicId: text('topic_id')
    .primaryKey()
    .references(() => topics.id, { onDelete: 'cascade' }),
  reason: text('reason').$type<'context' | 'budget'>().notNull().default('context'),
  spentCny: numeric('spent_cny'),
  limitFen: integer('limit_fen'),
  model: text('model').notNull(),
  provider: text('provider').notNull(),
  estimatedInputTokens: integer('estimated_input_tokens').notNull(),
  inputTokenLimit: integer('input_token_limit').notNull(),
  createdAt: createdAt(),
});
