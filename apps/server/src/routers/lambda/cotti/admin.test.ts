// @vitest-environment node
import { TRPCError } from '@trpc/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CottiPlatformAdminAccessService } from '@/server/services/cotti/adminAccess';

import { cottiRouter } from './index';

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(async () => ({})),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('cotti.admin router', () => {
  it('rejects an unauthenticated caller', async () => {
    const requireAccess = vi.spyOn(CottiPlatformAdminAccessService.prototype, 'requireAccess');
    const caller = cottiRouter.createCaller({ userId: null });

    await expect(caller.admin.getAccess()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(requireAccess).not.toHaveBeenCalled();
  });

  it('rejects an authenticated caller without platform access', async () => {
    vi.spyOn(CottiPlatformAdminAccessService.prototype, 'requireAccess').mockRejectedValue(
      new TRPCError({ code: 'FORBIDDEN', message: 'COTTI platform admin access denied' }),
    );
    const caller = cottiRouter.createCaller({ userId: 'member-user' });

    await expect(caller.admin.getAccess()).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'COTTI platform admin access denied',
    });
  });

  it('returns the safe access contract for an administrator', async () => {
    vi.spyOn(CottiPlatformAdminAccessService.prototype, 'requireAccess').mockResolvedValue({
      email: 'Admin@Example.com',
      normalizedEmail: 'admin@example.com',
      source: 'email_allowlist',
      userId: 'admin-user',
    });
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(caller.admin.getAccess()).resolves.toEqual({
      data: {
        email: 'admin@example.com',
        isAdmin: true,
        source: 'email_allowlist',
      },
      success: true,
    });
  });
});
