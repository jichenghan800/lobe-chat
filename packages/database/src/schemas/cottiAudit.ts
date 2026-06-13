import { index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { createdAt } from './_helpers';
import { messages } from './message';
import { sessions } from './session';
import { users } from './user';

export type CottiAuditViewTargetType = 'message' | 'session';

export const cottiAuditViewLogs = pgTable(
  'cotti_audit_view_logs',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),

    adminUserId: text('admin_user_id').references(() => users.id, { onDelete: 'set null' }),
    adminEmail: text('admin_email'),

    targetType: text('target_type').$type<CottiAuditViewTargetType>().notNull(),
    targetId: text('target_id').notNull(),
    messageId: text('message_id').references(() => messages.id, { onDelete: 'set null' }),
    sessionId: text('session_id').references(() => sessions.id, { onDelete: 'set null' }),
    targetUserId: text('target_user_id').references(() => users.id, { onDelete: 'set null' }),
    targetUserEmail: text('target_user_email'),

    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: createdAt(),
  },
  (table) => [
    index('cotti_audit_view_logs_admin_user_id_idx').on(table.adminUserId),
    index('cotti_audit_view_logs_target_idx').on(table.targetType, table.targetId),
    index('cotti_audit_view_logs_created_at_idx').on(table.createdAt),
  ],
);

export type CottiAuditViewLogItem = typeof cottiAuditViewLogs.$inferSelect;
export type NewCottiAuditViewLog = typeof cottiAuditViewLogs.$inferInsert;
