// @vitest-environment node
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import { cottiSandboxReservations, cottiSandboxSettings, topics, users } from '../../schemas';
import { CottiSandboxModel } from '../cottiSandbox';

const db = await getTestDB();
const model = new CottiSandboxModel(db);
const ttl = 120_000;
beforeEach(async () => {
  await db.delete(cottiSandboxReservations);
  await db.delete(cottiSandboxSettings);
});

describe('sandbox admission', () => {
  it('persists settings and reservations across model instances', async () => {
    expect(await model.getConfig()).toEqual({ maxSessions: 2, reservedSessions: 0 });
    await model.updateConfig(5, 'admin');
    await model.reserve('user-a/topic-a', ttl);
    expect(await new CottiSandboxModel(db).getConfig()).toEqual({
      maxSessions: 5,
      reservedSessions: 1,
    });
  });
  it('admits existing sessions after reducing capacity and applies increases immediately', async () => {
    await model.reserve('user-a/topic-a', ttl);
    await model.reserve('user-b/topic-a', ttl);
    await model.updateConfig(1, 'admin');
    expect(await model.reserve('user-a/topic-a', ttl)).toMatchObject({
      allowed: true,
      newlyReserved: false,
    });
    expect(await model.reserve('user-b/topic-a', ttl)).toMatchObject({
      allowed: true,
      newlyReserved: false,
    });
    expect(await model.reserve('user-c/topic-a', ttl)).toEqual({ allowed: false });
    await model.updateConfig(3, 'admin');
    expect(await model.reserve('user-c/topic-a', ttl)).toMatchObject({ allowed: true });
  });
  it('serializes concurrent requests for the last slot', async () => {
    await model.updateConfig(1, 'admin');
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => model.reserve(`user-${i}/topic`, ttl)),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(1);
    expect((await model.getConfig()).reservedSessions).toBe(1);
  });
  it('does not release a slot reused by a concurrent request', async () => {
    const first = await model.reserve('a', ttl);
    if (!first.allowed) throw new Error('expected admission');
    await model.reserve('a', ttl);
    await model.releaseRejected('a', first.revision);
    expect((await model.getConfig()).reservedSessions).toBe(1);
  });
  it('reclaims expired reservations and rejects invalid limits', async () => {
    await model.updateConfig(1, 'admin');
    await model.reserve('a', ttl);
    await db
      .update(cottiSandboxReservations)
      .set({ expiresAt: new Date(0) })
      .where(eq(cottiSandboxReservations.id, 'a'));
    expect(await model.reserve('b', ttl)).toMatchObject({ allowed: true });
    for (const limit of [0, -1, 1.5, 101, NaN])
      await expect(model.updateConfig(limit, 'admin')).rejects.toThrow();
    expect((await model.getConfig()).maxSessions).toBe(1);
  });
  it('resolves the persisted topic provider and enforces ownership and deletion', async () => {
    await db.insert(users).values([{ id: 'sandbox-owner' }, { id: 'sandbox-other' }]);
    try {
      await db.insert(topics).values([
        { id: 'sandbox-self', userId: 'sandbox-owner', metadata: { sandboxProvider: 'onlyboxes' } },
        { id: 'sandbox-legacy', userId: 'sandbox-owner' },
        { id: 'sandbox-deleted', userId: 'sandbox-owner', deletedAt: new Date() },
      ]);
      expect(await model.getTopicProvider('sandbox-owner', 'sandbox-self')).toBe('onlyboxes');
      expect(await model.getTopicProvider('sandbox-owner', 'sandbox-legacy')).toBeUndefined();
      await expect(model.getTopicProvider('sandbox-other', 'sandbox-self')).rejects.toThrow(
        'access denied',
      );
      await expect(model.getTopicProvider('sandbox-owner', 'sandbox-deleted')).rejects.toThrow(
        'not found',
      );
    } finally {
      await db.delete(users).where(eq(users.id, 'sandbox-owner'));
      await db.delete(users).where(eq(users.id, 'sandbox-other'));
    }
  });
});

describe('switch an unused topic sandbox', () => {
  const owner = 'sandbox-switch-owner';
  const topicId = 'sandbox-switch-topic';
  beforeEach(async () => {
    await db.delete(users).where(eq(users.id, owner));
    await db.insert(users).values({ id: owner });
    await db.insert(topics).values({
      id: topicId,
      userId: owner,
      metadata: { sandboxProvider: 'market' },
    });
  });
  it('switches without losing the topic or its metadata', async () => {
    expect(await model.switchUnusedTopic(owner, topicId, 'onlyboxes')).toEqual({
      status: 'switched',
    });
    expect(await model.getTopicProvider(owner, topicId)).toBe('onlyboxes');
    await expect(model.switchUnusedTopic('another-user', topicId, 'market')).rejects.toThrow(
      'access denied',
    );
  });
  it('blocks in-flight execution and permits a definite authentication rejection', async () => {
    const id = await model.beginExecution(owner, topicId, 'market');
    expect(await model.switchUnusedTopic(owner, topicId, 'onlyboxes')).toEqual({
      status: 'running',
    });
    await model.finishExecution(owner, topicId, id, true);
    expect(await model.switchUnusedTopic(owner, topicId, 'onlyboxes')).toEqual({
      status: 'switched',
    });
    await expect(model.beginExecution(owner, topicId, 'market')).rejects.toThrow('Sandbox changed');
  });
  it('preserves successful or uncertain execution even when another call fails auth', async () => {
    const first = await model.beginExecution(owner, topicId, 'market');
    const second = await model.beginExecution(owner, topicId, 'market');
    await model.finishExecution(owner, topicId, first, false);
    expect(await model.switchUnusedTopic(owner, topicId, 'onlyboxes')).toEqual({
      status: 'running',
    });
    await model.finishExecution(owner, topicId, second, true);
    expect(await model.switchUnusedTopic(owner, topicId, 'onlyboxes')).toEqual({
      status: 'new_topic_required',
    });
  });
  it('rejects a topic with a running operation', async () => {
    await db.update(topics).set({ status: 'running' }).where(eq(topics.id, topicId));
    expect(await model.switchUnusedTopic(owner, topicId, 'onlyboxes')).toEqual({
      status: 'running',
    });
  });
  it.each([
    ['MARKET_AUTH_REQUIRED', 'switched'],
    ['Command failed with exit code 1\n\nStderr:\nMARKET_AUTH_REQUIRED', 'switched'],
    ['Created report.docx', 'new_topic_required'],
    ['Request timed out', 'new_topic_required'],
    [null, 'new_topic_required'],
  ])('checks historical tool results: %s', async (content, status) => {
    const { messages, messagePlugins } = await import('../../schemas');
    await db.insert(messages).values({
      id: 'sandbox-switch-assistant',
      userId: owner,
      topicId,
      role: 'assistant',
      tools: [
        {
          id: 'call-switch',
          identifier: 'lobe-cloud-sandbox',
          apiName: 'executeCode',
          arguments: '{}',
          type: 'builtin',
        },
      ],
    });
    if (content !== null) {
      await db
        .insert(messages)
        .values({ id: 'sandbox-switch-tool', userId: owner, topicId, role: 'tool', content });
      await db.insert(messagePlugins).values({
        id: 'sandbox-switch-tool',
        userId: owner,
        toolCallId: 'call-switch',
        identifier: 'lobe-cloud-sandbox',
        apiName: 'executeCode',
      });
    }
    expect(await model.switchUnusedTopic(owner, topicId, 'onlyboxes')).toEqual({ status });
  });
});
