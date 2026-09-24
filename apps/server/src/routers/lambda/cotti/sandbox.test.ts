// @vitest-environment node
import { TRPCError } from '@trpc/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CottiSandboxModel } from '@/database/models/cottiSandbox';
import { CottiPlatformAdminAccessService } from '@/server/services/cotti/adminAccess';

import { cottiSandboxRouter } from './sandbox';

vi.mock('@/database/core/db-adaptor', () => ({ getServerDB: vi.fn(async () => ({})) }));
beforeEach(() => {
  vi.spyOn(CottiPlatformAdminAccessService.prototype, 'requireAccess').mockResolvedValue({
    email: 'admin@example.com',
    normalizedEmail: 'admin@example.com',
    source: 'email_allowlist',
    userId: 'admin',
  });
});
afterEach(() => vi.restoreAllMocks());
describe('sandbox management permissions', () => {
  it('rejects non-administrators for reads and writes', async () => {
    vi.spyOn(CottiPlatformAdminAccessService.prototype, 'requireAccess').mockRejectedValue(
      new TRPCError({ code: 'FORBIDDEN' }),
    );
    const get = vi.spyOn(CottiSandboxModel.prototype, 'getConfig');
    const update = vi.spyOn(CottiSandboxModel.prototype, 'updateConfig');
    const caller = cottiSandboxRouter.createCaller({ userId: 'member' });
    await expect(caller.detail()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(caller.update({ maxSessions: 5 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(get).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
  it('validates limits before persisting', async () => {
    const update = vi.spyOn(CottiSandboxModel.prototype, 'updateConfig');
    const caller = cottiSandboxRouter.createCaller({ userId: 'admin' });
    for (const maxSessions of [0, 1.5, 101]) {
      await expect(caller.update({ maxSessions })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    }
    expect(update).not.toHaveBeenCalled();
  });
});
