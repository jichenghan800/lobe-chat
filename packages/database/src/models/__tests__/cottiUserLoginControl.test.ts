import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import { session as authSessions, users } from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import { CottiUserLoginControlModel } from '../cottiUserLoginControl';

const serverDB: LobeChatDatabase = await getTestDB();
const targetUserId = 'cotti-login-control-target';
const otherUserId = 'cotti-login-control-other';
const model = new CottiUserLoginControlModel(serverDB);

beforeEach(async () => {
  await serverDB.delete(users);
  await serverDB.insert(users).values([
    {
      email: 'target@example.com',
      fullName: 'Target User',
      id: targetUserId,
      normalizedEmail: 'target@example.com',
    },
    {
      email: 'other@example.com',
      fullName: 'Other User',
      id: otherUserId,
      normalizedEmail: 'other@example.com',
    },
  ]);
});

afterEach(async () => {
  await serverDB.delete(users);
});

describe('CottiUserLoginControlModel', () => {
  it("disables a user and revokes only that user's Better Auth sessions", async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    await serverDB.insert(authSessions).values([
      {
        expiresAt,
        id: 'target-auth-session',
        token: 'target-auth-token',
        userId: targetUserId,
      },
      {
        expiresAt,
        id: 'other-auth-session',
        token: 'other-auth-token',
        userId: otherUserId,
      },
    ]);

    const result = await model.setLoginDisabled(targetUserId, true, 'left the company');

    expect(result?.sessionTokens).toEqual(['target-auth-token']);
    expect(result?.user).toMatchObject({
      banReason: 'left the company',
      id: targetUserId,
    });
    await expect(
      serverDB.select().from(authSessions).where(eq(authSessions.userId, targetUserId)),
    ).resolves.toHaveLength(0);
    await expect(
      serverDB.select().from(authSessions).where(eq(authSessions.userId, otherUserId)),
    ).resolves.toHaveLength(1);
    await expect(model.listDisabled()).resolves.toEqual([
      expect.objectContaining({ id: targetUserId }),
    ]);
  });

  it('restores login without recreating deleted sessions', async () => {
    await model.setLoginDisabled(targetUserId, true, 'temporary block');

    const result = await model.setLoginDisabled(targetUserId, false);

    expect(result?.user).toMatchObject({ banReason: null, id: targetUserId });
    await expect(model.listDisabled()).resolves.toEqual([]);
  });

  it('returns undefined for an unknown user', async () => {
    await expect(model.setLoginDisabled('missing-user', true)).resolves.toBeUndefined();
  });
});
