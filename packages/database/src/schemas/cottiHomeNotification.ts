import { boolean, pgTable, text, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';

import { timestamps } from './_helpers';

export const cottiHomeNotificationSettings = pgTable('cotti_home_notification_settings', {
  content: text('content').notNull(),
  enabled: boolean('enabled').default(false).notNull(),
  id: varchar('id', { length: 32 }).primaryKey().default('default'),
  updatedBy: text('updated_by'),
  ...timestamps,
});

export const insertCottiHomeNotificationSettingsSchema = createInsertSchema(
  cottiHomeNotificationSettings,
);

export type CottiHomeNotificationSettingsItem = typeof cottiHomeNotificationSettings.$inferSelect;
export type NewCottiHomeNotificationSettings = typeof cottiHomeNotificationSettings.$inferInsert;
