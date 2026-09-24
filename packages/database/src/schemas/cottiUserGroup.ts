import { boolean, jsonb, pgTable, text } from 'drizzle-orm/pg-core';

import type { ModelDisplayConfig } from '@/types/modelDisplay';

import { timestamps } from './_helpers';

/** Administrator-owned channel boundaries. Disabling a group must not remove its boundary. */
export const cottiUserGroups = pgTable('cotti_user_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  provider: text('provider').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  modelDisplay: jsonb('model_display').$type<ModelDisplayConfig>().notNull(),
  imageModels: jsonb('image_models').$type<string[]>().notNull().default([]),
  fastModel: text('fast_model').notNull(),
  updatedBy: text('updated_by'),
  ...timestamps,
});
