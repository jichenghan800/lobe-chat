// @vitest-environment node
import { TRPCError } from '@trpc/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CottiPlatformAdminAccessService } from '@/server/services/cotti/adminAccess';

import { cottiPlatformAnalyticsRouter } from './platformAnalytics';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@/server/services/cotti/platformAnalytics', () => ({
  CottiPlatformAnalyticsService: class {
    getDashboard = mocks.query;
  },
}));
vi.mock('@/database/core/db-adaptor', () => ({ getServerDB: vi.fn(async () => ({})) }));
afterEach(() => vi.restoreAllMocks());

describe('platform analytics permission boundary', () => {
  it('rejects unauthenticated requests before querying platform data', async () => {
    const query = mocks.query;
    await expect(
      cottiPlatformAnalyticsRouter.createCaller({ userId: null }).dashboard(),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(query).not.toHaveBeenCalled();
  });
  it('rejects ordinary users before querying platform data', async () => {
    vi.spyOn(CottiPlatformAdminAccessService.prototype, 'requireAccess').mockRejectedValue(
      new TRPCError({ code: 'FORBIDDEN' }),
    );
    const query = mocks.query;
    await expect(
      cottiPlatformAnalyticsRouter.createCaller({ userId: 'ordinary' }).dashboard(),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(query).not.toHaveBeenCalled();
  });
});
