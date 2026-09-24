// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../../core/getTestDB';
import { messages, topics, users } from '../../../schemas';
import { TopicModel } from '../../topic';

const db = await getTestDB();
const owner = 'cost-owner';
const other = 'cost-other';
const topic = 'cost-topic';
const model = new TopicModel(db, owner);

describe('recorded topic model costs', () => {
  beforeEach(async () => {
    await db.insert(users).values([{ id: owner }, { id: other }]);
    await db.insert(topics).values({ id: topic, userId: owner });
  });
  afterEach(async () => {
    await db.delete(users);
  });
  it('sums mixed models and legacy costs once while exposing missing cost records', async () => {
    await db.insert(messages).values([
      {
        id: 'c1',
        topicId: topic,
        userId: owner,
        role: 'assistant',
        model: 'gpt-5.6-terra',
        usage: { cost: 1 },
        metadata: { usage: { cost: 9 } },
      },
      {
        id: 'c2',
        topicId: topic,
        userId: owner,
        role: 'assistant',
        model: 'gemini-3.8-flash',
        metadata: { usage: { cost: 2 } },
      },
      { id: 'c3', topicId: topic, userId: owner, role: 'assistant', usage: { totalTokens: 500 } },
      { id: 'c4', topicId: topic, userId: owner, role: 'assistant', metadata: { cost: 0 } },
      {
        id: 'copied',
        topicId: topic,
        userId: owner,
        role: 'assistant',
        usage: { cost: 100 },
        metadata: { copied: true },
      },
      { id: 'user', topicId: topic, userId: owner, role: 'user', usage: { cost: 100 } },
      { id: 'foreign', topicId: topic, userId: other, role: 'assistant', usage: { cost: 100 } },
    ]);
    expect(await model.getRecordedModelCost(topic)).toEqual({
      totalUSD: 3,
      calls: 4,
      pricedCalls: 3,
    });
    expect(await new TopicModel(db, other).getRecordedModelCost(topic)).toEqual({
      totalUSD: null,
      calls: 0,
      pricedCalls: 0,
    });
  });
  it('keeps unmeasured cost null and rejects malformed or negative metadata', async () => {
    await db.insert(messages).values([
      { id: 'none', topicId: topic, userId: owner, role: 'assistant' },
      { id: 'bad', topicId: topic, userId: owner, role: 'assistant', metadata: { cost: 'bad' } },
      { id: 'negative', topicId: topic, userId: owner, role: 'assistant', metadata: { cost: -1 } },
    ]);
    expect(await model.getRecordedModelCost(topic)).toEqual({
      totalUSD: null,
      calls: 3,
      pricedCalls: 0,
    });
  });
});
