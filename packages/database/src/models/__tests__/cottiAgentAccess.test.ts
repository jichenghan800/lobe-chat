// @vitest-environment node
import { inArray } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import { cottiAgentAccessRules, cottiAgentAccessSettings, users } from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import {
  CottiAgentAccessModel,
  normalizeCottiAgentAccessEmailPrefix,
  normalizeCottiAgentAccessValue,
} from '../cottiAgentAccess';

const serverDB: LobeChatDatabase = await getTestDB();
const model = new CottiAgentAccessModel(serverDB);
const testUserIds = ['agent-access-search-user-1', 'agent-access-search-user-2'];

const cleanup = async () => {
  await serverDB.delete(cottiAgentAccessRules);
  await serverDB.delete(cottiAgentAccessSettings);
  await serverDB.delete(users).where(inArray(users.id, testUserIds));
};

beforeEach(cleanup);
afterEach(cleanup);

describe('CottiAgentAccessModel', () => {
  it('normalizes email values only', () => {
    expect(normalizeCottiAgentAccessValue('email', '  User@Cotti.com  ')).toBe('user@cotti.com');
    expect(normalizeCottiAgentAccessValue('userId', '  User-001  ')).toBe('User-001');
    expect(normalizeCottiAgentAccessValue('email', '   ')).toBe('');
    expect(normalizeCottiAgentAccessEmailPrefix('  User@Cotti.com  ')).toBe('user');
  });

  it('stores the singleton access mode setting', async () => {
    expect(await model.getSettings()).toBeUndefined();

    const first = await model.setMode('allowlist', 'admin-1');
    expect(first.mode).toBe('allowlist');
    expect(first.updatedBy).toBe('admin-1');

    const second = await model.setMode('off', 'admin-2');
    expect(second.id).toBe(first.id);
    expect(second.mode).toBe('off');
    expect(second.updatedBy).toBe('admin-2');
  });

  it('allows subjects by enabled email and user id rules', async () => {
    const emailRule = await model.upsertRule({
      createdBy: 'admin',
      note: 'first',
      type: 'email',
      value: ' User@Cotti.com ',
    });
    await model.upsertRule({
      createdBy: 'admin',
      type: 'userId',
      value: 'user-2',
    });

    expect(emailRule.value).toBe('user@cotti.com');
    await expect(model.isSubjectAllowed({ email: 'USER@COTTI.COM' })).resolves.toBe(true);
    await expect(model.isSubjectAllowed({ normalizedEmail: 'user@cotti.com' })).resolves.toBe(true);
    await expect(model.isSubjectAllowed({ userId: 'user-2' })).resolves.toBe(true);
    await expect(model.isSubjectAllowed({ email: 'other@cotti.com' })).resolves.toBe(false);
  });

  it('allows email rules by the mailbox prefix across domains', async () => {
    await model.upsertRule({
      type: 'email',
      value: 'jicheng.han@cotticoffee.com',
    });

    await expect(model.isSubjectAllowed({ email: 'jicheng.han@abite.com' })).resolves.toBe(true);
    await expect(model.isSubjectAllowed({ email: 'other.han@cotticoffee.com' })).resolves.toBe(
      false,
    );
  });

  it('searches existing users for admin allowlist suggestions', async () => {
    await serverDB.insert(users).values([
      {
        email: 'jicheng.han.agentaccess.test@cotticoffee.com',
        fullName: '韩继承',
        id: testUserIds[0],
        normalizedEmail: 'jicheng.han.agentaccess.test@cotticoffee.com',
        username: 'jicheng',
      },
      {
        email: 'other@cotticoffee.com',
        id: testUserIds[1],
        normalizedEmail: 'other@cotticoffee.com',
      },
    ]);

    await expect(model.searchUsers('jicheng')).resolves.toMatchObject([
      {
        email: 'jicheng.han.agentaccess.test@cotticoffee.com',
        fullName: '韩继承',
        id: testUserIds[0],
        normalizedEmail: 'jicheng.han.agentaccess.test@cotticoffee.com',
        username: 'jicheng',
      },
    ]);
    await expect(model.searchUsers('j')).resolves.toEqual([]);
  });

  it('resolves user names for email and user id rules', async () => {
    await serverDB.insert(users).values([
      {
        email: 'jicheng.han.agentaccess.test@cotticoffee.com',
        fullName: '韩继承',
        id: testUserIds[0],
        normalizedEmail: 'jicheng.han.agentaccess.test@cotticoffee.com',
        username: 'jicheng',
      },
      {
        email: 'other@cotticoffee.com',
        fullName: '其他用户',
        id: testUserIds[1],
        normalizedEmail: 'other@cotticoffee.com',
      },
    ]);
    await model.upsertRule({
      type: 'email',
      value: 'jicheng.han.agentaccess.test@cotticoffee.com',
    });
    await model.upsertRule({ type: 'userId', value: testUserIds[1] });

    await expect(model.listRules()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'email',
          user: expect.objectContaining({ fullName: '韩继承', username: 'jicheng' }),
        }),
        expect.objectContaining({
          type: 'userId',
          user: expect.objectContaining({ fullName: '其他用户', id: testUserIds[1] }),
        }),
      ]),
    );
  });

  it('updates duplicate rules and ignores disabled rules', async () => {
    const first = await model.upsertRule({
      note: 'old',
      type: 'email',
      value: 'user@cotti.com',
    });
    await model.setRuleEnabled(first.id, false);
    await expect(model.isSubjectAllowed({ email: 'user@cotti.com' })).resolves.toBe(false);

    const second = await model.upsertRule({
      note: 'new',
      type: 'email',
      value: 'USER@COTTI.COM',
    });

    expect(second.id).toBe(first.id);
    expect(second.enabled).toBe(true);
    expect(second.note).toBe('new');
    await expect(model.isSubjectAllowed({ email: 'user@cotti.com' })).resolves.toBe(true);
  });
});
