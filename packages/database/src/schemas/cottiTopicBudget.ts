import { boolean, integer, pgTable, text } from 'drizzle-orm/pg-core';

import { updatedAt } from './_helpers';

/** Platform default; scoped user overrides can be added without changing topic accounting. */
export const cottiTopicBudgetSettings = pgTable('cotti_topic_budget_settings', {
  id: text('id').primaryKey(),
  enabled: boolean('enabled').notNull().default(true),
  limitFen: integer('limit_fen').notNull().default(1000),
  updatedBy: text('updated_by'),
  updatedAt: updatedAt(),
});
