import { integer, pgTable, text } from 'drizzle-orm/pg-core';

import { updatedAt } from './_helpers';
import { topics } from './topic';

/** Administrator-owned override. Null inherits the owner's effective topic limit. */
export const cottiTopicPolicies = pgTable('cotti_topic_policies', {
  topicId: text('topic_id')
    .primaryKey()
    .references(() => topics.id, { onDelete: 'cascade' }),
  limitFen: integer('limit_fen'),
  updatedBy: text('updated_by'),
  updatedAt: updatedAt(),
});
