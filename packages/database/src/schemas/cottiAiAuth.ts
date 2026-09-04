import { boolean, index, pgSchema, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const cottiAiAuthSchema = pgSchema('cotti_ai_auth');

export const cottiAiAuthUsers = cottiAiAuthSchema.table(
  'user',
  {
    createdAt: timestamp('createdAt', { withTimezone: true }).defaultNow().notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('emailVerified').notNull(),
    id: text('id').primaryKey(),
    image: text('image'),
    name: text('name').notNull(),
    phoneNumber: text('phoneNumber'),
    phoneNumberVerified: boolean('phoneNumberVerified'),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('cotti_ai_auth_user_phone_number_unique').on(table.phoneNumber)],
);

export const cottiAiAccessMembers = cottiAiAuthSchema.table(
  'access_members',
  {
    authUserId: text('auth_user_id')
      .unique()
      .references(() => cottiAiAuthUsers.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    createdBy: text('created_by'),
    displayName: text('display_name').notNull(),
    email: text('email'),
    enabled: boolean('enabled').default(true).notNull(),
    id: text('id').primaryKey(),
    note: text('note'),
    phoneE164: text('phone_e164'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('access_members_email_unique').on(table.email),
    uniqueIndex('access_members_phone_unique').on(table.phoneE164),
    index('access_members_enabled_idx').on(table.enabled),
  ],
);

export type CottiAiAccessMemberItem = typeof cottiAiAccessMembers.$inferSelect;
