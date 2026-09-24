import { index, integer, pgTable, text } from 'drizzle-orm/pg-core';

import { timestamps, timestamptz } from './_helpers';

export const cottiSandboxSettings = pgTable('cotti_sandbox_settings', {
  id: text('id').primaryKey(),
  maxSessions: integer('max_sessions').notNull().default(2),
  updatedBy: text('updated_by'),
  ...timestamps,
});

// Deliberately independent of users/topics: deleting one must not release the
// capacity of a container which is still alive in the execution service.
export const cottiSandboxReservations = pgTable(
  'cotti_sandbox_reservations',
  {
    id: text('id').primaryKey(),
    revision: text('revision').notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
    ...timestamps,
  },
  (t) => [index('cotti_sandbox_reservations_expires_at_idx').on(t.expiresAt)],
);
