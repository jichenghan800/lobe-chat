// @vitest-environment node
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import { topics, users } from '../../schemas';
import { TopicCostFreezeModel } from '../topicCostFreeze';

const db = await getTestDB();
const values = {
  model: 'terra',
  provider: 'azure',
  estimatedInputTokens: 160_000,
  inputTokenLimit: 190_400,
};
describe('durable topic cost freeze', () => {
  beforeEach(async () => {
    await db.insert(users).values([{ id: 'freeze-owner' }, { id: 'freeze-other' }]);
    await db.insert(topics).values({ id: 'freeze-topic', userId: 'freeze-owner' });
  });
  afterEach(async () => {
    await db.delete(users).where(eq(users.id, 'freeze-owner'));
    await db.delete(users).where(eq(users.id, 'freeze-other'));
  });
  it('persists across model instances and topic edits, keeping the original freeze reason', async () => {
    const model = new TopicCostFreezeModel(db, 'freeze-owner');
    expect(await model.get('freeze-topic')).toBeNull();
    await model.freeze('freeze-topic', values);
    await model.freeze('freeze-topic', { ...values, model: 'another', estimatedInputTokens: 1 });
    await db
      .update(topics)
      .set({ model: 'another', metadata: {}, historySummary: 'short' })
      .where(eq(topics.id, 'freeze-topic'));
    const row = await new TopicCostFreezeModel(db, 'freeze-owner').get('freeze-topic');
    expect(row).toMatchObject(values);
    expect(row?.createdAt).toBeInstanceOf(Date);
  });
  it('does not expose or change another user’s freeze state', async () => {
    await new TopicCostFreezeModel(db, 'freeze-owner').freeze('freeze-topic', values);
    const other = new TopicCostFreezeModel(db, 'freeze-other');
    expect(await other.get('freeze-topic')).toBeNull();
    await expect(other.freeze('freeze-topic', values)).rejects.toThrow('Topic not found');
  });
  it('new topics remain usable and deleting the old topic removes only its freeze record', async () => {
    const model = new TopicCostFreezeModel(db, 'freeze-owner');
    await model.freeze('freeze-topic', values);
    await db.insert(topics).values({ id: 'freeze-new-topic', userId: 'freeze-owner' });
    expect(await model.get('freeze-new-topic')).toBeNull();
    await db.delete(topics).where(eq(topics.id, 'freeze-topic'));
    expect(await model.get('freeze-topic')).toBeNull();
  });
});
