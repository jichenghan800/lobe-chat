// @vitest-environment node
import { TRPCError } from '@trpc/server';
import { afterEach, expect, it, vi } from 'vitest';

import { CottiPlatformAdminAccessService } from '@/server/services/cotti/adminAccess';

import { cottiUsersRouter } from './users';

const mocks = vi.hoisted(() => ({ get: vi.fn(), list: vi.fn(), update: vi.fn() }));
vi.mock('@/database/core/db-adaptor', () => ({ getServerDB: vi.fn(async () => ({})) }));
vi.mock('@/database/models/cottiUserPolicy', () => ({
  CottiUserPolicyModel: class {
    get = mocks.get;
    list = mocks.list;
    update = mocks.update;
  },
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
it('rejects unauthenticated and non-admin user policy changes', async () => {
  await expect(
    cottiUsersRouter
      .createCaller({ userId: null })
      .update({ userId: 'target', vip: true, agentEnabled: true, topicLimitFen: 1000 }),
  ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  vi.spyOn(CottiPlatformAdminAccessService.prototype, 'requireAccess').mockRejectedValue(
    new TRPCError({ code: 'FORBIDDEN' }),
  );
  await expect(
    cottiUsersRouter.createCaller({ userId: 'other' }).list({ page: 1, pageSize: 20 }),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  expect(mocks.update).not.toHaveBeenCalled();
});
it('validates whole-fen limits and records the administrator', async () => {
  vi.spyOn(CottiPlatformAdminAccessService.prototype, 'requireAccess').mockResolvedValue({
    email: 'admin@example.com',
    normalizedEmail: 'admin@example.com',
    source: 'email_allowlist',
    userId: 'admin',
  });
  const caller = cottiUsersRouter.createCaller({ userId: 'admin' });
  for (const limitFen of [0, -1, 0.5, 100_000_001])
    await expect(
      caller.update({ userId: 'target', vip: true, agentEnabled: true, topicLimitFen: limitFen }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  await expect(caller.update({ userId: 'target' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  await caller.update({ userId: 'target', vip: true });
  expect(mocks.update).toHaveBeenLastCalledWith('target', { vip: true }, 'admin');
  await caller.update({ userId: 'target', vip: true, agentEnabled: true, topicLimitFen: 1000 });
  expect(mocks.update).toHaveBeenCalledWith(
    'target',
    { vip: true, agentEnabled: true, topicLimitFen: 1000 },
    'admin',
  );
});

it('only returns the authenticated caller policy', async () => {
  await cottiUsersRouter.createCaller({ userId: 'member' }).mine();
  expect(mocks.get).toHaveBeenCalledWith('member');
});
