import { boolean, integer, pgTable, text } from 'drizzle-orm/pg-core';

import { updatedAt } from './_helpers';
import { users } from './user';

/** Administrator-owned entitlements, separate from user-editable preferences. */
export const cottiUserPolicies = pgTable('cotti_user_policies', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  vip: boolean('vip').notNull().default(false),
  agentEnabled: boolean('agent_enabled').notNull().default(false),
  /** Null inherits the platform topic budget. Amounts are stored in fen. */
  topicLimitFen: integer('topic_limit_fen'),
  updatedBy: text('updated_by'),
  updatedAt: updatedAt(),
});
