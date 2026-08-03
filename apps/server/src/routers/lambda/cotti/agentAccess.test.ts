// @vitest-environment node
import { TRPCError } from '@trpc/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CottiPlatformAdminAccessService } from '@/server/services/cotti/adminAccess';
import { CottiAgentModeVisibilityService } from '@/server/services/cotti/agentModeVisibility';

import { cottiRouter } from './index';

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(async () => ({})),
}));

const adminIdentity = {
  email: 'admin@example.com',
  normalizedEmail: 'admin@example.com',
  source: 'email_allowlist' as const,
  userId: 'admin-user',
};

const rule = {
  accessedAt: new Date('2026-08-03T00:00:00.000Z'),
  createdAt: new Date('2026-08-03T00:00:00.000Z'),
  createdBy: 'admin-user',
  enabled: true,
  id: '00000000-0000-4000-8000-000000000001',
  note: '完成基础培训',
  type: 'email' as const,
  updatedAt: new Date('2026-08-03T00:00:00.000Z'),
  value: 'member@example.com',
};

afterEach(() => {
  vi.restoreAllMocks();
});

const mockAdminAccess = () =>
  vi
    .spyOn(CottiPlatformAdminAccessService.prototype, 'requireAccess')
    .mockResolvedValue(adminIdentity);

describe('cotti.agentAccess router', () => {
  it('rejects an unauthenticated status request', async () => {
    const getVisibility = vi.spyOn(CottiAgentModeVisibilityService.prototype, 'getVisibility');
    const caller = cottiRouter.createCaller({ userId: null });

    await expect(caller.agentAccess.status()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(getVisibility).not.toHaveBeenCalled();
  });

  it('returns only the Agent mode entry visibility to an authenticated user', async () => {
    vi.spyOn(CottiAgentModeVisibilityService.prototype, 'getVisibility').mockResolvedValue(false);
    const caller = cottiRouter.createCaller({ userId: 'member-user' });

    await expect(caller.agentAccess.status()).resolves.toEqual({
      data: { visible: false },
      success: true,
    });
  });

  it('rejects configuration access from a non-admin user', async () => {
    vi.spyOn(CottiPlatformAdminAccessService.prototype, 'requireAccess').mockRejectedValue(
      new TRPCError({ code: 'FORBIDDEN', message: 'COTTI platform admin access denied' }),
    );
    const getDetail = vi.spyOn(CottiAgentModeVisibilityService.prototype, 'getDetail');
    const caller = cottiRouter.createCaller({ userId: 'member-user' });

    await expect(caller.agentAccess.detail()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(getDetail).not.toHaveBeenCalled();
  });

  it('returns the visibility configuration to an administrator', async () => {
    mockAdminAccess();
    vi.spyOn(CottiAgentModeVisibilityService.prototype, 'getDetail').mockResolvedValue({
      mode: 'allowlist',
      rules: [rule],
      source: 'database',
    });
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(caller.agentAccess.detail()).resolves.toEqual({
      data: { mode: 'allowlist', rules: [rule], source: 'database' },
      success: true,
    });
  });

  it('updates the entry visibility mode as an administrator', async () => {
    mockAdminAccess();
    vi.spyOn(CottiAgentModeVisibilityService.prototype, 'setMode').mockResolvedValue({
      accessedAt: new Date(),
      createdAt: new Date(),
      id: 'default',
      mode: 'open',
      updatedAt: new Date(),
      updatedBy: 'admin-user',
    });
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(caller.agentAccess.setMode({ mode: 'open' })).resolves.toEqual({
      data: { mode: 'open' },
      message: 'Agent mode entry visibility updated',
      success: true,
    });
  });

  it('searches users only when the query has at least two characters', async () => {
    mockAdminAccess();
    const searchUsers = vi
      .spyOn(CottiAgentModeVisibilityService.prototype, 'searchUsers')
      .mockResolvedValue([]);
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(caller.agentAccess.searchUsers({ query: 'm' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    await expect(caller.agentAccess.searchUsers({ query: 'member' })).resolves.toEqual({
      data: [],
      success: true,
    });
    expect(searchUsers).toHaveBeenCalledOnce();
  });

  it('saves a visibility rule through the administrator contract', async () => {
    mockAdminAccess();
    const upsertRule = vi
      .spyOn(CottiAgentModeVisibilityService.prototype, 'upsertRule')
      .mockResolvedValue(rule);
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(
      caller.agentAccess.upsertRule({
        note: '完成基础培训',
        type: 'email',
        value: 'member@example.com',
      }),
    ).resolves.toEqual({
      data: rule,
      message: 'Agent mode visibility rule saved',
      success: true,
    });
    expect(upsertRule).toHaveBeenCalledWith({
      note: '完成基础培训',
      type: 'email',
      value: 'member@example.com',
    });
  });

  it('returns NOT_FOUND when a visibility rule no longer exists', async () => {
    mockAdminAccess();
    vi.spyOn(CottiAgentModeVisibilityService.prototype, 'setRuleEnabled').mockResolvedValue(
      undefined,
    );
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(
      caller.agentAccess.setRuleEnabled({ enabled: false, id: rule.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
