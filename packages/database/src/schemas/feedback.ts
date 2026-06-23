import { index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { createdAt, updatedAt } from './_helpers';
import { users } from './user';

export type FeedbackReportStatus = 'ignored' | 'open' | 'resolved' | 'reviewing';

export const feedbackReports = pgTable(
  'feedback_reports',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),

    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    userEmail: text('user_email'),

    title: text('title').notNull(),
    message: text('message').notNull(),
    status: text('status').$type<FeedbackReportStatus>().notNull().default('open'),

    screenshotUrl: text('screenshot_url'),
    issueUrl: text('issue_url'),
    clientInfo: jsonb('client_info').$type<Record<string, unknown>>(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('feedback_reports_user_id_idx').on(table.userId),
    index('feedback_reports_status_idx').on(table.status),
    index('feedback_reports_created_at_idx').on(table.createdAt),
  ],
);

export type FeedbackReportItem = typeof feedbackReports.$inferSelect;
export type NewFeedbackReport = typeof feedbackReports.$inferInsert;
