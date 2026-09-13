// @vitest-environment node
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import { agents, cottiModelDisplaySettings, tasks, topics, users } from '../../schemas';
import { CottiModelDisplayModel } from '../cottiModelDisplay';
import { CottiTaskModelMigrationModel } from '../cottiTaskModelMigration';

const db = await getTestDB();
const model = new CottiTaskModelMigrationModel(db);
const source = { model: 'old', provider: 'provider-a' };
const target = { model: 'new', provider: 'provider-b' };
const cleanup = async () => {
  await db.delete(topics);
  await db.delete(tasks);
  await db.delete(agents);
  await db.delete(users);
  await db.delete(cottiModelDisplaySettings);
};
beforeEach(async () => {
  await cleanup();
  await db.insert(users).values([{ id: 'migration-a' }, { id: 'migration-b' }]);
  await db.insert(agents).values({ id: 'migration-agent', userId: 'migration-a', ...source });
  const list = [
    { ...source, enabled: true },
    { ...target, enabled: true },
  ];
  await new CottiModelDisplayModel(db).updateConfig({
    agent: list,
    chat: list,
    defaults: { agent: source, chat: source },
  });
  await db.insert(topics).values([
    {
      id: 'migration-topic',
      userId: 'migration-b',
      ...source,
      metadata: { model: 'summary-model', provider: 'summary-provider' },
    },
    { id: 'other-topic', userId: 'migration-a', ...target },
  ]);
  await db.insert(tasks).values([
    {
      id: 'migration-1',
      identifier: 'T-1',
      seq: 1,
      createdByUserId: 'migration-a',
      instruction: 'a',
      config: { ...source, schedule: { maxExecutions: 8 } },
      status: 'scheduled',
    },
    {
      id: 'migration-2',
      identifier: 'T-2',
      seq: 2,
      createdByUserId: 'migration-b',
      instruction: 'b',
      config: source,
      status: 'running',
    },
    {
      id: 'migration-3',
      identifier: 'T-3',
      seq: 3,
      createdByUserId: 'migration-a',
      instruction: 'c',
      config: source,
      status: 'completed',
    },
    {
      id: 'migration-4',
      identifier: 'T-4',
      seq: 4,
      createdByUserId: 'migration-a',
      assigneeAgentId: 'migration-agent',
      instruction: 'legacy',
      config: {},
      status: 'paused',
    },
    {
      id: 'migration-5',
      identifier: 'T-5',
      seq: 5,
      createdByUserId: 'migration-a',
      instruction: 'deleted',
      config: source,
      isDeleted: true,
    },
  ]);
});
afterEach(cleanup);

describe('CottiTaskModelMigrationModel', () => {
  it('previews cross-user unfinished and legacy tasks, excluding completed and deleted rows', async () => {
    const p = await model.preview(source);
    expect(p.taskCount).toBe(3);
    expect(p.runningCount).toBe(1);
    expect(p.agentCount).toBe(1);
    expect(p.tasks.map((t) => t.id)).toEqual(['migration-1', 'migration-2', 'migration-4']);
  });
  it('migrates only future config with audit and preserves unrelated settings and terminal history', async () => {
    const p = await model.preview(source);
    const result = await model.migrate(source, target, p.revision, 'admin');
    expect(result.migratedCount).toBe(3);
    const [changed] = await db.select().from(tasks).where(eq(tasks.id, 'migration-1'));
    expect(changed.config).toMatchObject({
      ...target,
      schedule: { maxExecutions: 8 },
      cottiModelMigrations: [{ from: source, to: target, by: 'admin' }],
    });
    const [history] = await db.select().from(tasks).where(eq(tasks.id, 'migration-3'));
    expect(history.config).toEqual(source);
    expect(result.config.defaults).toEqual({ agent: target, chat: target });
    expect(result.config.agent.find((r) => r.model === 'old')?.enabled).toBe(false);
    const [agent] = await db.select().from(agents).where(eq(agents.id, 'migration-agent'));
    expect(agent.model).toBe('new');
    expect(agent.provider).toBe(target.provider);
    expect(result.topicCount).toBe(1);
    const [topic] = await db.select().from(topics).where(eq(topics.id, 'migration-topic'));
    expect(topic).toMatchObject(target);
    expect(topic.metadata).toEqual({ model: 'summary-model', provider: 'summary-provider' });
    expect(result.config.retirements).toEqual([
      expect.objectContaining({ source, target, by: 'admin' }),
    ]);
  });
  it('rejects stale previews before changing either tasks or model configuration', async () => {
    const p = await model.preview(source);
    await db
      .update(tasks)
      .set({ updatedAt: new Date(Date.now() + 1000), name: 'changed' })
      .where(eq(tasks.id, 'migration-1'));
    await expect(model.migrate(source, target, p.revision, 'admin')).rejects.toThrow('重新预览');
    expect((await new CottiModelDisplayModel(db).getConfig()).agent[0].enabled).toBe(true);
  });
  it('rejects a disabled target and leaves the source enabled', async () => {
    const config = await new CottiModelDisplayModel(db).getConfig();
    config.agent[1].enabled = false;
    await new CottiModelDisplayModel(db).updateConfig(config);
    const p = await model.preview(source);
    await expect(model.migrate(source, target, p.revision, 'admin')).rejects.toThrow('Agent');
    expect((await model.preview(source)).taskCount).toBe(3);
  });
  it('does not let a stale settings save erase a global retirement', async () => {
    const stale = await new CottiModelDisplayModel(db).getConfig();
    const preview = await model.preview(source);
    await model.migrate(source, target, preview.revision, 'admin');
    const saved = await new CottiModelDisplayModel(db).updateConfig(stale);
    expect(saved.config.retirements).toHaveLength(1);
    expect(saved.config.chat.find((r) => r.model === source.model)?.enabled).toBe(false);
  });
  it('invalidates a preview when a topic selection changes', async () => {
    const p = await model.preview(source);
    await db.update(topics).set(target).where(eq(topics.id, 'migration-topic'));
    await expect(model.migrate(source, target, p.revision, 'admin')).rejects.toThrow('重新预览');
  });
  it('rejects self migration', async () => {
    const p = await model.preview(source);
    await expect(model.migrate(source, source, p.revision, 'admin')).rejects.toThrow('相同');
  });
});
