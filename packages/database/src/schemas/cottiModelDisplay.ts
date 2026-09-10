import { jsonb, pgTable, text, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';

import { type ModelDisplayConfig } from '@/types/modelDisplay';

import { timestamps } from './_helpers';

export const cottiModelDisplaySettings = pgTable('cotti_model_display_settings', {
  config: jsonb('config').$type<ModelDisplayConfig>().notNull(),
  id: varchar('id', { length: 32 }).primaryKey().default('default'),
  updatedBy: text('updated_by'),
  ...timestamps,
});

export const insertCottiModelDisplaySettingsSchema = createInsertSchema(cottiModelDisplaySettings);

export type CottiModelDisplaySettingsItem = typeof cottiModelDisplaySettings.$inferSelect;
export type NewCottiModelDisplaySettings = typeof cottiModelDisplaySettings.$inferInsert;
