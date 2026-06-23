import { boolean, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';

import { timestamps } from './_helpers';

export type CottiAgentAccessMode = 'allowlist' | 'off' | 'open';
export type CottiAgentAccessRuleType = 'email' | 'userId';

export const cottiAgentAccessSettings = pgTable('cotti_agent_access_settings', {
  id: varchar('id', { length: 32 }).primaryKey().default('default'),
  mode: varchar('mode', { length: 32 })
    .$type<CottiAgentAccessMode>()
    .default('allowlist')
    .notNull(),
  updatedBy: text('updated_by'),
  ...timestamps,
});

export const cottiAgentAccessRules = pgTable(
  'cotti_agent_access_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: varchar('type', { length: 32 }).$type<CottiAgentAccessRuleType>().notNull(),
    value: text('value').notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    note: text('note'),
    createdBy: text('created_by'),
    ...timestamps,
  },
  (t) => [uniqueIndex('cotti_agent_access_rules_type_value_unique').on(t.type, t.value)],
);

export const insertCottiAgentAccessSettingsSchema = createInsertSchema(cottiAgentAccessSettings);
export const insertCottiAgentAccessRuleSchema = createInsertSchema(cottiAgentAccessRules);

export type CottiAgentAccessSettingsItem = typeof cottiAgentAccessSettings.$inferSelect;
export type CottiAgentAccessRuleItem = typeof cottiAgentAccessRules.$inferSelect;
export type NewCottiAgentAccessSettings = typeof cottiAgentAccessSettings.$inferInsert;
export type NewCottiAgentAccessRule = typeof cottiAgentAccessRules.$inferInsert;
