import { index, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { createdAt, timestamps } from './_helpers';
import { messages } from './message';
import { sessions } from './session';
import { users } from './user';

export type CottiAuditRiskAnalysisStatus = 'completed' | 'failed' | 'pending' | 'running';
export type CottiAuditViewTargetType = 'message' | 'session' | 'topic';

export interface CottiAuditRiskEvidence {
  label: string;
  quote: string;
}

export const cottiAuditRiskAnalyses = pgTable(
  'cotti_audit_risk_analyses',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),

    messageId: text('message_id')
      .references(() => messages.id, { onDelete: 'cascade' })
      .notNull(),
    sessionId: text('session_id').references(() => sessions.id, { onDelete: 'set null' }),
    targetUserId: text('target_user_id').references(() => users.id, { onDelete: 'set null' }),
    targetUserEmail: text('target_user_email'),

    status: text('status').$type<CottiAuditRiskAnalysisStatus>().notNull().default('pending'),
    summary: text('summary'),
    reason: text('reason'),
    confidence: text('confidence').$type<'high' | 'low' | 'medium'>(),
    evidence: jsonb('evidence').$type<CottiAuditRiskEvidence[]>().default([]),
    riskLevel: text('risk_level'),
    riskLabels: jsonb('risk_labels').$type<string[]>().default([]),

    model: text('model'),
    provider: text('provider'),
    error: text('error'),
    requestedByUserId: text('requested_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    requestedByEmail: text('requested_by_email'),

    ...timestamps,
  },
  (table) => [
    uniqueIndex('cotti_audit_risk_analyses_message_id_unique').on(table.messageId),
    index('cotti_audit_risk_analyses_status_idx').on(table.status),
    index('cotti_audit_risk_analyses_created_at_idx').on(table.createdAt),
  ],
);

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

export type CottiAuditRiskAnalysisItem = typeof cottiAuditRiskAnalyses.$inferSelect;
export type NewCottiAuditRiskAnalysis = typeof cottiAuditRiskAnalyses.$inferInsert;
export type CottiAuditViewLogItem = typeof cottiAuditViewLogs.$inferSelect;
export type NewCottiAuditViewLog = typeof cottiAuditViewLogs.$inferInsert;
