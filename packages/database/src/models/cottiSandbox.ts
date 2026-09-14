import { randomUUID } from 'node:crypto';

import { and, count, eq, gt, isNull, lte, sql } from 'drizzle-orm';

import { cottiSandboxReservations, cottiSandboxSettings, topics } from '../schemas';
import type { LobeChatDatabase } from '../type';

const SETTINGS_ID = 'default';
export const DEFAULT_SANDBOX_MAX_SESSIONS = 2;

export class CottiSandboxModel {
  constructor(private db: LobeChatDatabase) {}

  async getTopicProvider(userId: string, topicId: string) {
    const [topic] = await this.db
      .select({ metadata: topics.metadata })
      .from(topics)
      .where(and(eq(topics.id, topicId), eq(topics.userId, userId), isNull(topics.deletedAt)));
    if (!topic) throw new Error('Sandbox topic not found or access denied');
    const provider = topic.metadata?.sandboxProvider;
    if (provider !== undefined && provider !== 'market' && provider !== 'onlyboxes') {
      throw new Error('Unsupported topic sandbox provider');
    }
    return provider;
  }

  async getConfig() {
    const [config] = await this.db
      .select()
      .from(cottiSandboxSettings)
      .where(eq(cottiSandboxSettings.id, SETTINGS_ID));
    const [usage] = await this.db
      .select({ reservedSessions: count() })
      .from(cottiSandboxReservations)
      .where(gt(cottiSandboxReservations.expiresAt, sql`now()`));
    return {
      maxSessions: config?.maxSessions ?? DEFAULT_SANDBOX_MAX_SESSIONS,
      reservedSessions: usage.reservedSessions,
    };
  }

  async updateConfig(maxSessions: number, updatedBy: string) {
    if (!Number.isInteger(maxSessions) || maxSessions < 1 || maxSessions > 100) {
      throw new Error('Sandbox capacity must be an integer between 1 and 100');
    }
    await this.db
      .insert(cottiSandboxSettings)
      .values({ id: SETTINGS_ID, maxSessions, updatedBy })
      .onConflictDoUpdate({
        target: cottiSandboxSettings.id,
        set: { maxSessions, updatedBy, updatedAt: new Date() },
      });
    return this.getConfig();
  }

  async reserve(sessionKey: string, retentionMs: number) {
    if (!Number.isFinite(retentionMs) || retentionMs <= 0)
      throw new Error('Invalid reservation lifetime');
    return this.db.transaction(async (tx) => {
      await tx.insert(cottiSandboxSettings).values({ id: SETTINGS_ID }).onConflictDoNothing();
      // One persistent row serializes admissions and administrator updates across
      // app processes. Existing sessions are admitted before testing the limit.
      const [config] = await tx
        .select()
        .from(cottiSandboxSettings)
        .where(eq(cottiSandboxSettings.id, SETTINGS_ID))
        .for('update');
      await tx
        .delete(cottiSandboxReservations)
        .where(lte(cottiSandboxReservations.expiresAt, sql`now()`));
      const [existing] = await tx
        .select()
        .from(cottiSandboxReservations)
        .where(eq(cottiSandboxReservations.id, sessionKey));
      if (!existing) {
        const [usage] = await tx.select({ total: count() }).from(cottiSandboxReservations);
        if (usage.total >= config.maxSessions) return { allowed: false as const };
      }
      const revision = randomUUID();
      const expiresAt = sql`now() + ${Math.ceil(retentionMs)} * interval '1 millisecond'`;
      await tx
        .insert(cottiSandboxReservations)
        .values({ id: sessionKey, revision, expiresAt })
        .onConflictDoUpdate({
          target: cottiSandboxReservations.id,
          set: {
            revision,
            expiresAt: sql`greatest(${cottiSandboxReservations.expiresAt}, ${expiresAt})`,
            updatedAt: new Date(),
          },
        });
      return { allowed: true as const, newlyReserved: !existing, revision };
    });
  }

  // Only a definite rejection before execution can release a new reservation.
  // A later concurrent request changes revision and prevents premature release.
  async releaseRejected(sessionKey: string, revision: string) {
    await this.db
      .delete(cottiSandboxReservations)
      .where(
        and(
          eq(cottiSandboxReservations.id, sessionKey),
          eq(cottiSandboxReservations.revision, revision),
        ),
      );
  }
}
