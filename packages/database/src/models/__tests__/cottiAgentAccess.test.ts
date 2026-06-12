// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import { cottiAgentAccessRules, cottiAgentAccessSettings } from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import { CottiAgentAccessModel, normalizeCottiAgentAccessValue } from '../cottiAgentAccess';

const serverDB: LobeChatDatabase = await getTestDB();
const model = new CottiAgentAccessModel(serverDB);

const cleanup = async () => {
  await serverDB.delete(cottiAgentAccessRules);
  await serverDB.delete(cottiAgentAccessSettings);
};

beforeEach(cleanup);
afterEach(cleanup);

describe('CottiAgentAccessModel', () => {
  it('normalizes email values only', () => {
    expect(normalizeCottiAgentAccessValue('email', '  User@Cotti.com  ')).toBe('user@cotti.com');
    expect(normalizeCottiAgentAccessValue('userId', '  User-001  ')).toBe('User-001');
    expect(normalizeCottiAgentAccessValue('email', '   ')).toBe('');
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
