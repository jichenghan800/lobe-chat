// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import { cottiLoginAccessRules, cottiLoginAccessSettings } from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import { CottiLoginAccessModel, normalizeCottiLoginAccessValue } from '../cottiLoginAccess';

const serverDB: LobeChatDatabase = await getTestDB();
const model = new CottiLoginAccessModel(serverDB);

const cleanup = async () => {
  await serverDB.delete(cottiLoginAccessRules);
  await serverDB.delete(cottiLoginAccessSettings);
};

beforeEach(cleanup);
afterEach(cleanup);

describe('CottiLoginAccessModel', () => {
  it('normalizes email and domain rules', () => {
    expect(normalizeCottiLoginAccessValue('email', ' User@Example.com ')).toBe('user@example.com');
    expect(normalizeCottiLoginAccessValue('domain', ' @Example.com ')).toBe('example.com');
  });

  it('initializes the database configuration without overwriting a later explicit mode', async () => {
    await model.initialize({
      mode: 'allowlist',
      rules: [{ type: 'domain', value: 'example.com' }],
    });
    await model.setMode('open');
    await model.initialize({ mode: 'allowlist', rules: [] });

    await expect(model.getSettings()).resolves.toMatchObject({ mode: 'open' });
    await expect(model.listRules()).resolves.toEqual([
      expect.objectContaining({ type: 'domain', value: 'example.com' }),
    ]);
  });

  it('allows enabled exact emails and domains only', async () => {
    const emailRule = await model.upsertRule({ type: 'email', value: 'person@other.com' });
    await model.upsertRule({ type: 'domain', value: 'example.com' });

    await expect(model.isEmailAllowed('USER@EXAMPLE.COM')).resolves.toBe(true);
    await expect(model.isEmailAllowed('person@other.com')).resolves.toBe(true);
    await expect(model.isEmailAllowed('another@other.com')).resolves.toBe(false);

    await model.setRuleEnabled(emailRule.id, false);
    await expect(model.isEmailAllowed('person@other.com')).resolves.toBe(false);
  });

  it('removes an imported rule by normalized type and value', async () => {
    await model.initialize({
      mode: 'allowlist',
      rules: [
        { type: 'domain', value: 'example.com' },
        { type: 'email', value: 'person@other.com' },
      ],
    });

    await model.removeRuleByValue('email', ' Person@Other.com ');

    await expect(model.listRules()).resolves.toEqual([
      expect.objectContaining({ type: 'domain', value: 'example.com' }),
    ]);
  });
});
