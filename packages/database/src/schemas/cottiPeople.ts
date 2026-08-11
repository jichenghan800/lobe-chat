import { boolean, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';

import { timestamps } from './_helpers';
import { users } from './user';

export type CottiLoginAccessMode = 'allowlist' | 'open';
export type CottiLoginAccessRuleType = 'domain' | 'email';

/** Deployment-wide registration policy for email/password and new SSO identities. */
export const cottiLoginAccessSettings = pgTable('cotti_login_access_settings', {
  id: varchar('id', { length: 32 }).primaryKey().default('default'),
  mode: varchar('mode', { length: 32 })
    .$type<CottiLoginAccessMode>()
    .default('allowlist')
    .notNull(),
  updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
  ...timestamps,
});

/** Emails and domains allowed to create a new account when registration is restricted. */
export const cottiLoginAccessRules = pgTable(
  'cotti_login_access_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: varchar('type', { length: 32 }).$type<CottiLoginAccessRuleType>().notNull(),
    value: text('value').notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    note: text('note'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [uniqueIndex('cotti_login_access_rules_type_value_unique').on(t.type, t.value)],
);

/** Explicit COTTI platform-management administrators. Environment admins remain a fallback. */
export const cottiPlatformAdminAssignments = pgTable(
  'cotti_platform_admin_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    note: text('note'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [uniqueIndex('cotti_platform_admin_assignments_user_id_unique').on(t.userId)],
);

export const insertCottiLoginAccessSettingsSchema = createInsertSchema(cottiLoginAccessSettings);
export const insertCottiLoginAccessRuleSchema = createInsertSchema(cottiLoginAccessRules);
export const insertCottiPlatformAdminAssignmentSchema = createInsertSchema(
  cottiPlatformAdminAssignments,
);

export type CottiLoginAccessSettingsItem = typeof cottiLoginAccessSettings.$inferSelect;
export type CottiLoginAccessRuleItem = typeof cottiLoginAccessRules.$inferSelect;
export type CottiPlatformAdminAssignmentItem = typeof cottiPlatformAdminAssignments.$inferSelect;
export type NewCottiLoginAccessRule = typeof cottiLoginAccessRules.$inferInsert;
export type NewCottiPlatformAdminAssignment = typeof cottiPlatformAdminAssignments.$inferInsert;
