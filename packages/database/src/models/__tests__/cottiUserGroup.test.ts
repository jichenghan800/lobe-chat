// @vitest-environment node
import { eq, inArray } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import { cottiUserGroups, users, userSettings } from '../../schemas';
import { CottiUserGroupModel } from '../cottiUserGroup';
import { CottiUserPolicyModel } from '../cottiUserPolicy';
import { UserModel } from '../user';

const db = await getTestDB();
const groups = new CottiUserGroupModel(db);
const policies = new CottiUserPolicyModel(db);
const ids = ['channel-group-a', 'channel-group-b'];
const ref = { provider: 'openai', model: 'gpt-5.6-sol', enabled: true };
const config = { chat: [ref], agent: [ref], defaults: { chat: ref, agent: ref } };

beforeEach(async () => {
  await db.insert(users).values(ids.map((id) => ({ id })));
  await db.insert(cottiUserGroups).values({
    id: 'pressure-test',
    name: '压测组',
    provider: 'openai',
    modelDisplay: config,
    fastModel: 'gpt-5.6-sol',
    imageModels: ['gpt-image-2.5-flare'],
  });
});
afterEach(async () => {
  await db.delete(users).where(inArray(users.id, ids));
  await db.delete(cottiUserGroups).where(eq(cottiUserGroups.id, 'pressure-test'));
});

describe('administrator-owned channel groups', () => {
  it('reserves the channel for assigned users and checks model IDs', async () => {
    await policies.update(ids[0], { groupId: 'pressure-test' }, 'admin');
    expect(await groups.allows(ids[0], 'openai', 'gpt-5.6-sol')).toBe(true);
    expect(await groups.allows(ids[0], 'openai', 'gpt-image-2.5-flare')).toBe(true);
    expect(await groups.allows(ids[0], 'openai', 'unlisted')).toBe(false);
    expect(await groups.allows(ids[0], 'azure', 'gpt-5.6-sol')).toBe(false);
    expect(await groups.allows(ids[1], 'openai', 'gpt-5.6-sol')).toBe(false);
    expect(await groups.allows(ids[1], 'vertexai', 'gemini-3.8-flash')).toBe(true);
    expect((await groups.modelDisplay(config, ids[1])).chat).toEqual([]);
    expect((await groups.modelDisplay(config, ids[0])).defaults).toEqual(config.defaults);
  });
  it('revokes access immediately, keeps the disabled channel reserved, and supports removal', async () => {
    await policies.update(ids[0], { groupId: 'pressure-test' }, 'admin');
    await db
      .update(cottiUserGroups)
      .set({ enabled: false })
      .where(eq(cottiUserGroups.id, 'pressure-test'));
    expect(await groups.allows(ids[0], 'openai', 'gpt-5.6-sol')).toBe(false);
    expect(await groups.allows(ids[1], 'openai', 'gpt-5.6-sol')).toBe(false);
    expect((await groups.modelDisplay(config, ids[0])).chat).toEqual([]);
    await policies.update(ids[0], { groupId: null }, 'admin');
    expect((await policies.get(ids[0])).groupId).toBeNull();
    expect(await groups.allows(ids[0], 'azure', 'gpt-5.6-terra')).toBe(true);
    await expect(policies.update(ids[0], { groupId: 'missing' }, 'admin')).rejects.toBeDefined();
  });
});

it('resolves auxiliary settings to the group channel without changing stored preferences', async () => {
  await db
    .insert(userSettings)
    .values({ id: ids[0], systemAgent: { topic: { model: 'legacy-fast', provider: 'vertexai' } } });
  await policies.update(ids[0], { groupId: 'pressure-test' }, 'admin');
  const effective = await new UserModel(db, ids[0]).getUserSettings();
  expect(effective?.systemAgent).toMatchObject({
    topic: { model: 'gpt-5.6-sol', provider: 'openai' },
  });
  const stored = await db.query.userSettings.findFirst({ where: eq(userSettings.id, ids[0]) });
  expect(stored?.systemAgent).toMatchObject({
    topic: { model: 'legacy-fast', provider: 'vertexai' },
  });
});
