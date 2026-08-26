// @vitest-environment node
import { TRPCError } from '@trpc/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CottiPlatformAdminAccessService } from '@/server/services/cotti/adminAccess';
import { CottiTopicOverviewService } from '@/server/services/cotti/topicOverview';

import { cottiRouter } from './index';

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(async () => ({})),
}));

const adminIdentity = {
  email: 'Admin@example.com',
  normalizedEmail: 'admin@example.com',
  source: 'email_allowlist' as const,
  userId: 'admin-user',
};

beforeEach(() => {
  vi.spyOn(CottiPlatformAdminAccessService.prototype, 'requireAccess').mockResolvedValue(
    adminIdentity,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('cotti.topicOverview router', () => {
  it('rejects a caller without platform administrator access', async () => {
    vi.spyOn(CottiPlatformAdminAccessService.prototype, 'requireAccess').mockRejectedValue(
      new TRPCError({ code: 'FORBIDDEN', message: 'denied' }),
    );
    const list = vi.spyOn(CottiTopicOverviewService.prototype, 'list');
    const caller = cottiRouter.createCaller({ userId: 'member-user' });

    await expect(caller.topicOverview.list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(list).not.toHaveBeenCalled();
  });

  it('loads the server-paginated topic list', async () => {
    const overview = { items: [], page: 2, pageSize: 50 as const, query: { q: 'alice' }, total: 0 };
    const list = vi.spyOn(CottiTopicOverviewService.prototype, 'list').mockResolvedValue(overview);
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(caller.topicOverview.list({ page: 2, pageSize: 50, q: 'alice' })).resolves.toEqual(
      { data: overview, success: true },
    );
    expect(list).toHaveBeenCalledWith({ page: 2, pageSize: 50, q: 'alice' });
  });

  it('records the administrator identity when topic detail is returned', async () => {
    const detail = {
      createdAt: new Date().toISOString(),
      id: 'topic-1',
      imageCount: 1,
      messageCount: 2,
      messages: [],
      messagesTruncated: false,
      mode: 'chat' as const,
      updatedAt: new Date().toISOString(),
      userId: 'target-user',
    };
    vi.spyOn(CottiTopicOverviewService.prototype, 'getDetail').mockResolvedValue(detail);
    const recordView = vi
      .spyOn(CottiTopicOverviewService.prototype, 'recordView')
      .mockResolvedValue(undefined);
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(caller.topicOverview.detail({ topicId: 'topic-1' })).resolves.toEqual({
      data: detail,
      success: true,
    });
    expect(recordView).toHaveBeenCalledWith({
      adminEmail: 'admin@example.com',
      adminUserId: 'admin-user',
      target: detail,
    });
  });
});
