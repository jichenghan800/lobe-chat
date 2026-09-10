// @vitest-environment node
import { inArray } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import { users } from '../../schemas';
import { CottiUserPolicyModel } from '../cottiUserPolicy';

const db = await getTestDB();
const model = new CottiUserPolicyModel(db);
const ids = ['policy-a', 'policy-b', 'policy-c'];
beforeEach(async () => {
  await db
    .insert(users)
    .values(
      ids.map((id, index) => ({ id, email: `${id}@example.com`, phone: `policy-phone-${index}` })),
    );
});
afterEach(async () => {
  await db.delete(users).where(inArray(users.id, ids));
});
describe('administrator-owned user policy', () => {
  it('defaults to ordinary Chat and inherited budget, isolates users and supports independent fields', async () => {
    expect(await model.get(ids[0])).toEqual({
      agentEnabled: false,
      vip: false,
      topicLimitFen: null,
    });
    await model.update(ids[0], { agentEnabled: true, vip: false, topicLimitFen: 500 }, 'admin');
    expect(await model.get(ids[1])).toEqual({
      agentEnabled: false,
      vip: false,
      topicLimitFen: null,
    });
    await model.update(ids[0], { agentEnabled: false, vip: true, topicLimitFen: null }, 'admin');
    expect(await model.get(ids[0])).toEqual({
      agentEnabled: false,
      vip: true,
      topicLimitFen: null,
    });
    await expect(
      model.update('missing-user', { agentEnabled: true, vip: true, topicLimitFen: 1 }, 'admin'),
    ).rejects.toThrow('User not found');
  });
  it('includes users without policy rows in total, filters and pagination', async () => {
    await model.update(ids[0], { agentEnabled: true, vip: true, topicLimitFen: null }, 'admin');
    const page = await model.list({ page: 1, pageSize: 2, query: 'policy-' });
    expect(page.total).toBe(3);
    expect(page.items).toHaveLength(2);
    const second = await model.list({ page: 2, pageSize: 2, query: 'policy-' });
    expect(new Set([...page.items, ...second.items].map((u) => u.id)).size).toBe(3);
    expect((await model.list({ page: 1, pageSize: 20, query: 'policy-', vip: false })).total).toBe(
      2,
    );
    expect(
      (await model.list({ page: 1, pageSize: 20, query: 'policy-', agentEnabled: false })).total,
    ).toBe(2);
    expect((await model.list({ page: 1, pageSize: 20, query: 'policy-phone-0' })).items[0].id).toBe(
      ids[0],
    );
  });
});
