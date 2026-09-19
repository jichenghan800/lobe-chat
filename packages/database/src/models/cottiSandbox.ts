import { randomUUID } from 'node:crypto';

import { and, count, eq, gt, inArray, isNull, lte, sql } from 'drizzle-orm';

import {
  agentOperations,
  cottiSandboxReservations,
  cottiSandboxSettings,
  messagePlugins,
  messages,
  topics,
} from '../schemas';
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

  private async withTopic<T>(
    userId: string,
    topicId: string,
    run: (
      tx: Parameters<Parameters<LobeChatDatabase['transaction']>[0]>[0],
      topic: typeof topics.$inferSelect,
    ) => Promise<T>,
  ) {
    return this.db.transaction(async (tx) => {
      const [topic] = await tx
        .select()
        .from(topics)
        .where(and(eq(topics.id, topicId), eq(topics.userId, userId), isNull(topics.deletedAt)))
        .for('update');
      if (!topic) throw new Error('Sandbox topic not found or access denied');
      return run(tx, topic);
    });
  }

  async beginExecution(userId: string, topicId: string, provider: 'market' | 'onlyboxes') {
    return this.withTopic(userId, topicId, async (tx, topic) => {
      if (topic.metadata?.sandboxProvider && topic.metadata.sandboxProvider !== provider)
        throw new Error('Sandbox changed before execution. Retry the tool call.');
      const id = randomUUID();
      const activity = topic.metadata?.sandboxActivity ?? { pending: [], used: false };
      await tx
        .update(topics)
        .set({
          metadata: {
            ...topic.metadata,
            sandboxProvider: provider,
            sandboxActivity: { ...activity, pending: [...activity.pending, id] },
          },
        })
        .where(eq(topics.id, topicId));
      return id;
    });
  }

  async finishExecution(userId: string, topicId: string, id: string, authRejected: boolean) {
    return this.withTopic(userId, topicId, async (tx, topic) => {
      const activity = topic.metadata?.sandboxActivity;
      if (!activity?.pending.includes(id)) return;
      await tx
        .update(topics)
        .set({
          metadata: {
            ...topic.metadata,
            sandboxActivity: {
              pending: activity.pending.filter((pending) => pending !== id),
              used: activity.used || !authRejected,
            },
          },
        })
        .where(eq(topics.id, topicId));
    });
  }

  async switchUnusedTopic(userId: string, topicId: string, provider: 'market' | 'onlyboxes') {
    return this.withTopic(userId, topicId, async (tx, topic) => {
      const activity = topic.metadata?.sandboxActivity;
      const [running] = await tx
        .select({ id: agentOperations.id })
        .from(agentOperations)
        .where(
          and(
            eq(agentOperations.topicId, topicId),
            inArray(agentOperations.status, [
              'running',
              'waiting_for_async_tool',
              'waiting_for_human',
            ]),
          ),
        )
        .limit(1);
      if (
        topic.status === 'running' ||
        topic.metadata?.runningOperation ||
        activity?.pending.length ||
        running
      )
        return { status: 'running' as const };
      if (activity?.used) return { status: 'new_topic_required' as const };

      // A failed command can still have written files. Only definite auth
      // rejections prove that an old, uninstrumented call never executed.
      const calls = await tx
        .select({ tools: messages.tools })
        .from(messages)
        .where(
          and(
            eq(messages.topicId, topicId),
            eq(messages.userId, userId),
            eq(messages.role, 'assistant'),
          ),
        );
      const sandboxCalls = calls
        .flatMap(({ tools }) => tools ?? [])
        .filter(
          (tool) =>
            tool.identifier === 'lobe-cloud-sandbox' ||
            (tool.identifier === 'lobe-skills' &&
              ['runCommand', 'execScript'].includes(tool.apiName)),
        );
      if (sandboxCalls.length) {
        const results = await tx
          .select({
            callId: messagePlugins.toolCallId,
            content: messages.content,
          })
          .from(messages)
          .innerJoin(messagePlugins, eq(messagePlugins.id, messages.id))
          .where(and(eq(messages.topicId, topicId), eq(messages.userId, userId)));
        const byCall = new Map(results.map((row) => [row.callId, row.content]));
        const authOnly = (content: string | null | undefined) =>
          content?.trim() === 'MARKET_AUTH_REQUIRED' ||
          content?.trim() === 'Command failed with exit code 1\n\nStderr:\nMARKET_AUTH_REQUIRED';
        if (sandboxCalls.some((tool) => !authOnly(byCall.get(tool.id))))
          return { status: 'new_topic_required' as const };
      }
      await tx
        .update(topics)
        .set({ metadata: { ...topic.metadata, sandboxProvider: provider } })
        .where(eq(topics.id, topicId));
      return { status: 'switched' as const };
    });
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
