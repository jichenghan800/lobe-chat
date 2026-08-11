// @vitest-environment node
import { inArray } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import { cottiPlatformAdminAssignments, users } from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import { CottiPlatformAdminModel } from '../cottiPlatformAdmin';

const serverDB: LobeChatDatabase = await getTestDB();
const model = new CottiPlatformAdminModel(serverDB);
const userIds = ['people-admin-user-1', 'people-admin-user-2'];

const cleanup = async () => {
  await serverDB.delete(cottiPlatformAdminAssignments);
  await serverDB.delete(users).where(inArray(users.id, userIds));
};

beforeEach(async () => {
  await cleanup();
  await serverDB.insert(users).values([
    { email: 'admin-one@example.com', id: userIds[0], normalizedEmail: 'admin-one@example.com' },
    { email: 'admin-two@example.com', id: userIds[1], normalizedEmail: 'admin-two@example.com' },
  ]);
});
afterEach(cleanup);

describe('CottiPlatformAdminModel', () => {
  it('adds one assignment per user and resolves the user profile', async () => {
    const first = await model.add(userIds[0], userIds[1], 'owner');
    const second = await model.add(userIds[0], userIds[1], 'updated');

    expect(second.id).toBe(first.id);
    await expect(model.isAssigned(userIds[0])).resolves.toBe(true);
    await expect(model.list()).resolves.toEqual([
      expect.objectContaining({
        note: 'updated',
        user: expect.objectContaining({ email: 'admin-one@example.com', id: userIds[0] }),
      }),
    ]);
  });

  it('keeps at least one database administrator', async () => {
    const first = await model.add(userIds[0], userIds[0]);
    await expect(model.remove(first.id)).resolves.toBe(false);

    const second = await model.add(userIds[1], userIds[0]);
    await expect(model.remove(first.id)).resolves.toBe(true);
    await expect(model.isAssigned(userIds[0])).resolves.toBe(false);
    await expect(model.isAssigned(userIds[1])).resolves.toBe(true);
    expect(second.userId).toBe(userIds[1]);
  });
});
