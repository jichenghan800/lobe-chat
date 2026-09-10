// @vitest-environment node
import { inArray } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import {
  agents,
  agentsFiles,
  documents,
  files,
  messages,
  messagesFiles,
  topics,
  users,
} from '../../schemas';
import { AgentModel } from '../agent';
import { MessageModel } from '../message';

const db = await getTestDB();
const owner = 'payload-owner';
const other = 'payload-other';
const body = 'synthetic'.repeat(131072);
beforeEach(async () => {
  await db.insert(users).values([{ id: owner }, { id: other }]);
  await db.insert(agents).values({ id: 'payload-agent', userId: owner });
  await db.insert(topics).values({ id: 'payload-topic', agentId: 'payload-agent', userId: owner });
  for (const id of ['payload-file', 'payload-disabled']) {
    await db
      .insert(files)
      .values({
        id,
        userId: owner,
        fileType: 'text/plain',
        name: `${id}.txt`,
        size: body.length,
        url: 'synthetic',
      });
    await db
      .insert(documents)
      .values({
        id: `${id}-doc`,
        userId: owner,
        fileId: id,
        content: body,
        fileType: 'text/plain',
        sourceType: 'file',
        source: 'synthetic',
        totalCharCount: body.length,
        totalLineCount: 1,
      });
    await db
      .insert(agentsFiles)
      .values({
        agentId: 'payload-agent',
        fileId: id,
        userId: owner,
        enabled: id === 'payload-file',
      });
  }
  await db
    .insert(messages)
    .values({
      id: 'payload-message',
      userId: owner,
      topicId: 'payload-topic',
      role: 'user',
      content: 'test',
    });
  await db
    .insert(messagesFiles)
    .values({ messageId: 'payload-message', fileId: 'payload-file', userId: owner });
});
afterEach(async () => {
  await db.delete(users).where(inArray(users.id, [owner, other]));
});

describe('UI metadata and runtime file body boundaries', () => {
  it('keeps agent metadata small while explicit runtime reads retain enabled content only', async () => {
    const model = new AgentModel(db, owner);
    const ui = await model.getAgentConfigById('payload-agent', { includeFileContent: false });
    expect(JSON.stringify(ui).length).toBeLessThan(10000);
    expect(ui?.files).toHaveLength(2);
    const runtime = await model.getAgentConfigById('payload-agent', {
      includeFileContent: true,
      fileContentIds: ['payload-file', 'payload-disabled'],
    });
    expect(runtime?.files.find((f) => f.id === 'payload-file')?.content).toBe(body);
    expect(runtime?.files.find((f) => f.id === 'payload-disabled')?.content).toBeUndefined();
    expect(
      await new AgentModel(db, other).getAgentConfigById('payload-agent', {
        includeFileContent: true,
      }),
    ).toBeNull();
  });

  it('omits message bodies for both list and grouped-message detail queries', async () => {
    const model = new MessageModel(db, owner, undefined, undefined, { includeFileContent: false });
    for (const result of [
      await model.query({ topicId: 'payload-topic' }),
      await model.queryByIds(['payload-message']),
    ]) {
      expect(result[0].fileList?.[0].id).toBe('payload-file');
      expect(result[0].fileList?.[0].content).toBeUndefined();
      expect(JSON.stringify(result).length).toBeLessThan(10000);
    }
  });

  it('hydrates only requested associated files and preserves owner isolation', async () => {
    const runtime = new MessageModel(db, owner, undefined, undefined, {
      includeFileContent: true,
      fileContentIds: ['payload-file'],
    });
    expect((await runtime.query({ topicId: 'payload-topic' }))[0].fileList?.[0].content).toBe(body);
    expect((await runtime.queryByIds(['payload-message']))[0].fileList?.[0].content).toBe(body);
    const excluded = new MessageModel(db, owner, undefined, undefined, {
      includeFileContent: true,
      fileContentIds: ['not-associated'],
    });
    expect(
      (await excluded.query({ topicId: 'payload-topic' }))[0].fileList?.[0].content,
    ).toBeUndefined();
    const stranger = new MessageModel(db, other, undefined, undefined, {
      includeFileContent: true,
      fileContentIds: ['payload-file'],
    });
    expect(await stranger.query({ topicId: 'payload-topic' })).toEqual([]);
    expect(await stranger.queryByIds(['payload-message'])).toEqual([]);
    // Existing server runtime callers keep full content without changing their contract.
    expect(
      (await new MessageModel(db, owner).query({ topicId: 'payload-topic' }))[0].fileList?.[0]
        .content,
    ).toBe(body);
  });
});
