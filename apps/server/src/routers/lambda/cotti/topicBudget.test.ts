// @vitest-environment node
import { TRPCError } from '@trpc/server';
import { afterEach, expect, it, vi } from 'vitest';

import { CottiPlatformAdminAccessService } from '@/server/services/cotti/adminAccess';

import { cottiTopicBudgetRouter } from './topicBudget';

const mocks = vi.hoisted(() => ({ getConfig: vi.fn(), updateConfig: vi.fn() }));
vi.mock('@/database/core/db-adaptor', () => ({ getServerDB: vi.fn(async () => ({})) }));
vi.mock('@/database/models/cottiTopicBudget', () => ({
  CottiTopicBudgetModel: class {
    getConfig = mocks.getConfig;
    updateConfig = mocks.updateConfig;
  },
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
it('rejects unauthenticated and non-admin budget changes', async () => {
  await expect(
    cottiTopicBudgetRouter.createCaller({ userId: null }).update({ enabled: true, limitFen: 1000 }),
  ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  vi.spyOn(CottiPlatformAdminAccessService.prototype, 'requireAccess').mockRejectedValue(
    new TRPCError({ code: 'FORBIDDEN' }),
  );
  await expect(
    cottiTopicBudgetRouter.createCaller({ userId: 'other' }).detail(),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  expect(mocks.updateConfig).not.toHaveBeenCalled();
});
it('validates whole-fen limits and records the administrator', async () => {
  vi.spyOn(CottiPlatformAdminAccessService.prototype, 'requireAccess').mockResolvedValue({
    email: 'admin@example.com',
    normalizedEmail: 'admin@example.com',
    source: 'email_allowlist',
    userId: 'admin',
  });
  const caller = cottiTopicBudgetRouter.createCaller({ userId: 'admin' });
  for (const limitFen of [0, -1, 0.5, 100_000_001])
    await expect(caller.update({ enabled: true, limitFen })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  await caller.update({ enabled: true, limitFen: 1000 });
  expect(mocks.updateConfig).toHaveBeenCalledWith({ enabled: true, limitFen: 1000 }, 'admin');
});
