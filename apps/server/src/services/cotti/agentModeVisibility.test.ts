import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LobeChatDatabase } from '@/database/type';

import type { CottiAgentModeVisibilityStore } from './agentModeVisibility';
import {
  CottiAgentModeVisibilityService,
  resolveCottiAgentAccessMode,
  resolveCottiAgentModeVisibilityFromEnvironment,
} from './agentModeVisibility';

const createDatabase = (user?: { email: null | string; normalizedEmail: null | string }) => {
  const limit = vi.fn().mockResolvedValue(user ? [user] : []);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));

  return { db: { select } as unknown as LobeChatDatabase, select };
};

const createAccessStore = () => {
  const mocks = {
    getSettings: vi.fn(),
    isSubjectAllowed: vi.fn(),
    listRules: vi.fn(),
    removeRule: vi.fn(),
    searchUsers: vi.fn(),
    setMode: vi.fn(),
    setRuleEnabled: vi.fn(),
    upsertRule: vi.fn(),
  };
  const store: CottiAgentModeVisibilityStore = mocks;

  return { mocks, store };
};

beforeEach(() => {
  vi.stubEnv('COTTI_AGENT_ACCESS_MODE', 'allowlist');
  vi.stubEnv('COTTI_AGENT_ALLOWED_EMAILS', '');
  vi.stubEnv('COTTI_AGENT_ALLOWED_USER_IDS', '');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('COTTI Agent mode entry visibility policy', () => {
  it('normalizes supported modes and defaults invalid values to allowlist', () => {
    expect(resolveCottiAgentAccessMode(' OPEN ')).toBe('open');
    expect(resolveCottiAgentAccessMode('off')).toBe('off');
    expect(resolveCottiAgentAccessMode('invalid')).toBe('allowlist');
    expect(resolveCottiAgentAccessMode(undefined)).toBe('allowlist');
  });

  it('resolves open and off modes without an identity', () => {
    expect(
      resolveCottiAgentModeVisibilityFromEnvironment({
        environment: { mode: 'open' },
        subject: {},
      }),
    ).toBe(true);
    expect(
      resolveCottiAgentModeVisibilityFromEnvironment({
        environment: { mode: 'off' },
        subject: { email: 'member@example.com' },
      }),
    ).toBe(false);
  });

  it('matches allowlisted user ids and normalized email addresses', () => {
    const environment = {
      allowedEmails: ' Admin@Example.com;owner@example.com',
      allowedUserIds: 'USER-1,user-2',
      mode: 'allowlist',
    };

    expect(
      resolveCottiAgentModeVisibilityFromEnvironment({
        environment,
        subject: { userId: 'user-1' },
      }),
    ).toBe(true);
    expect(
      resolveCottiAgentModeVisibilityFromEnvironment({
        environment,
        subject: { normalizedEmail: 'ADMIN@example.com' },
      }),
    ).toBe(true);
    expect(
      resolveCottiAgentModeVisibilityFromEnvironment({
        environment,
        subject: { email: 'member@example.com', userId: 'user-3' },
      }),
    ).toBe(false);
  });

  it('keeps the production mailbox-prefix compatibility across email domains', () => {
    expect(
      resolveCottiAgentModeVisibilityFromEnvironment({
        environment: {
          allowedEmails: 'jicheng.han@cotticoffee.com',
          mode: 'allowlist',
        },
        subject: { email: 'jicheng.han@abite.com' },
      }),
    ).toBe(true);
  });
});

describe('CottiAgentModeVisibilityService', () => {
  it('uses an explicit database open mode without querying the user', async () => {
    const { db, select } = createDatabase();
    const { mocks, store } = createAccessStore();
    mocks.getSettings.mockResolvedValue({
      createdAt: new Date(),
      id: 'default',
      mode: 'open',
      updatedAt: new Date(),
      updatedBy: null,
    });

    await expect(
      new CottiAgentModeVisibilityService(db, 'user-1', store).getVisibility(),
    ).resolves.toBe(true);
    expect(select).not.toHaveBeenCalled();
    expect(mocks.isSubjectAllowed).not.toHaveBeenCalled();
  });

  it('gives an explicit database allowlist priority over an open environment', async () => {
    vi.stubEnv('COTTI_AGENT_ACCESS_MODE', 'open');
    const { db } = createDatabase({
      email: 'member@example.com',
      normalizedEmail: 'member@example.com',
    });
    const { mocks, store } = createAccessStore();
    mocks.getSettings.mockResolvedValue({
      createdAt: new Date(),
      id: 'default',
      mode: 'allowlist',
      updatedAt: new Date(),
      updatedBy: null,
    });
    mocks.isSubjectAllowed.mockResolvedValue(false);

    await expect(
      new CottiAgentModeVisibilityService(db, 'user-1', store).getVisibility(),
    ).resolves.toBe(false);
  });

  it('combines database and environment allowlists before database settings exist', async () => {
    vi.stubEnv('COTTI_AGENT_ALLOWED_EMAILS', 'member@cotticoffee.com');
    const { db } = createDatabase({
      email: 'member@abite.com',
      normalizedEmail: 'member@abite.com',
    });
    const { mocks, store } = createAccessStore();
    mocks.getSettings.mockResolvedValue(undefined);
    mocks.isSubjectAllowed.mockResolvedValue(false);

    await expect(
      new CottiAgentModeVisibilityService(db, 'user-1', store).getVisibility(),
    ).resolves.toBe(true);
  });

  it('reuses the visibility lookup within one service instance', async () => {
    vi.stubEnv('COTTI_AGENT_ACCESS_MODE', 'off');
    const { db } = createDatabase();
    const { mocks, store } = createAccessStore();
    mocks.getSettings.mockResolvedValue(undefined);
    const service = new CottiAgentModeVisibilityService(db, 'user-1', store);

    await expect(Promise.all([service.getVisibility(), service.getVisibility()])).resolves.toEqual([
      false,
      false,
    ]);
    expect(mocks.getSettings).toHaveBeenCalledTimes(1);
  });

  it('records the administrator on mode and rule updates', async () => {
    const { db } = createDatabase();
    const { mocks, store } = createAccessStore();
    const service = new CottiAgentModeVisibilityService(db, 'admin-user', store);

    await service.setMode('allowlist');
    await service.upsertRule({
      note: '完成基础培训',
      type: 'email',
      value: ' Member@Example.com ',
    });

    expect(mocks.setMode).toHaveBeenCalledWith('allowlist', 'admin-user');
    expect(mocks.upsertRule).toHaveBeenCalledWith({
      createdBy: 'admin-user',
      note: '完成基础培训',
      type: 'email',
      value: 'member@example.com',
    });
  });
});
