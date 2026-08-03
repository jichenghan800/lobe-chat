// @vitest-environment node
import { TRPCError } from '@trpc/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CottiPlatformAdminAccessService } from '@/server/services/cotti/adminAccess';
import { CottiPlatformAnalyticsService } from '@/server/services/cotti/platformAnalytics';

import { cottiRouter } from './index';

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(async () => ({})),
}));

const dashboard = {
  generatedAt: '2026-08-03T04:30:00.000Z',
  overview: {
    activeTopics: 1,
    activeUsers: 1,
    assistantMessages: 1,
    averageCostPerAssistantMessage: 0.01,
    errorMessages: 0,
    errorRate: 0,
    newUsers: 1,
    recordedCost: 0.01,
    totalInputTokens: 10,
    totalOutputTokens: 5,
    totalTokens: 15,
    totalUsers: 2,
    userMessages: 1,
  },
  period: {
    endAt: '2026-08-03T04:30:00.000Z',
    endDate: '2026-08-03',
    presetDays: 7 as const,
    startAt: '2026-07-27T16:00:00.000Z',
    startDate: '2026-07-28',
    timezone: 'Asia/Shanghai' as const,
    type: 'preset' as const,
  },
  trends: [],
};

const agents = {
  generatedAt: '2026-08-03T04:30:00.000Z',
  items: [],
  page: 1,
  pageSize: 20,
  period: dashboard.period,
  total: 0,
};

const chatUsers = {
  generatedAt: '2026-08-03T04:30:00.000Z',
  items: [],
  page: 1,
  pageSize: 20,
  period: dashboard.period,
  total: 0,
};

const chatModels = {
  generatedAt: '2026-08-03T04:30:00.000Z',
  items: [],
  page: 1,
  pageSize: 20,
  period: dashboard.period,
  total: 0,
};

const features = {
  files: {
    activeUsers: 1,
    distinctFiles: 2,
    fileRelations: 2,
    messagesWithFiles: 1,
  },
  generatedAt: '2026-08-03T04:30:00.000Z',
  generations: [
    {
      activeUsers: 1,
      errorResults: 0,
      requests: 1,
      requestsWithoutResults: 0,
      resultRows: 1,
      successfulAssets: 1,
      type: 'image' as const,
    },
    {
      activeUsers: 0,
      errorResults: 0,
      requests: 0,
      requestsWithoutResults: 0,
      resultRows: 0,
      successfulAssets: 0,
      type: 'video' as const,
    },
  ],
  period: dashboard.period,
  search: {
    activeUsers: 1,
    builtinSearchMessages: 1,
    totalSearchEvents: 1,
    webSearchToolResults: 0,
  },
  tools: {
    activeUsers: 1,
    errorResults: 0,
    rejectedOrAbortedResults: 0,
    results: 1,
  },
};

const mockAdminAccess = () =>
  vi.spyOn(CottiPlatformAdminAccessService.prototype, 'requireAccess').mockResolvedValue({
    email: 'admin@example.com',
    normalizedEmail: 'admin@example.com',
    source: 'email_allowlist',
    userId: 'admin-user',
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('cotti.platformAnalytics router', () => {
  it('rejects an unauthenticated Agent analytics caller before querying', async () => {
    const getAgents = vi.spyOn(CottiPlatformAnalyticsService.prototype, 'getAgents');
    const caller = cottiRouter.createCaller({ userId: null });

    await expect(caller.platformAnalytics.agents()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(getAgents).not.toHaveBeenCalled();
  });

  it('returns paginated Agent analytics to an administrator', async () => {
    mockAdminAccess();
    const getAgents = vi
      .spyOn(CottiPlatformAnalyticsService.prototype, 'getAgents')
      .mockResolvedValue(agents);
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });
    const query = {
      page: 2,
      pageSize: 20,
      q: 'operations',
      range: { days: 30 as const, type: 'preset' as const },
      sortBy: 'executions' as const,
    };

    await expect(caller.platformAnalytics.agents(query)).resolves.toEqual({
      data: agents,
      success: true,
    });
    expect(getAgents).toHaveBeenCalledWith(query);
  });

  it('rejects an invalid Agent sort before querying analytics', async () => {
    mockAdminAccess();
    const getAgents = vi.spyOn(CottiPlatformAnalyticsService.prototype, 'getAgents');
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(
      caller.platformAnalytics.agents({
        // @ts-expect-error Testing runtime validation for an unsupported sort field.
        sortBy: 'llmCalls',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(getAgents).not.toHaveBeenCalled();
  });

  it('wraps unexpected Agent analytics errors without exposing internals', async () => {
    mockAdminAccess();
    vi.spyOn(CottiPlatformAnalyticsService.prototype, 'getAgents').mockRejectedValue(
      new Error('database details'),
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(caller.platformAnalytics.agents()).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to load COTTI platform Agent analytics',
    });
  });

  it('rejects an unauthenticated Chat model analytics caller before querying', async () => {
    const getChatModels = vi.spyOn(CottiPlatformAnalyticsService.prototype, 'getChatModels');
    const caller = cottiRouter.createCaller({ userId: null });

    await expect(caller.platformAnalytics.chatModels()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(getChatModels).not.toHaveBeenCalled();
  });

  it('returns paginated Chat model analytics to an administrator', async () => {
    mockAdminAccess();
    const getChatModels = vi
      .spyOn(CottiPlatformAnalyticsService.prototype, 'getChatModels')
      .mockResolvedValue(chatModels);
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });
    const query = {
      page: 2,
      pageSize: 20,
      q: 'vertex',
      range: { days: 30 as const, type: 'preset' as const },
      sortBy: 'activeUsers' as const,
    };

    await expect(caller.platformAnalytics.chatModels(query)).resolves.toEqual({
      data: chatModels,
      success: true,
    });
    expect(getChatModels).toHaveBeenCalledWith(query);
  });

  it('rejects an invalid Chat model sort before querying analytics', async () => {
    mockAdminAccess();
    const getChatModels = vi.spyOn(CottiPlatformAnalyticsService.prototype, 'getChatModels');
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(
      caller.platformAnalytics.chatModels({
        // @ts-expect-error Testing runtime validation for an unsupported sort field.
        sortBy: 'llmCalls',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(getChatModels).not.toHaveBeenCalled();
  });

  it('wraps unexpected Chat model analytics errors without exposing internals', async () => {
    mockAdminAccess();
    vi.spyOn(CottiPlatformAnalyticsService.prototype, 'getChatModels').mockRejectedValue(
      new Error('database details'),
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(caller.platformAnalytics.chatModels()).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to load COTTI platform Chat model analytics',
    });
  });

  it('rejects an unauthenticated Chat user analytics caller before querying', async () => {
    const getChatUsers = vi.spyOn(CottiPlatformAnalyticsService.prototype, 'getChatUsers');
    const caller = cottiRouter.createCaller({ userId: null });

    await expect(caller.platformAnalytics.chatUsers()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(getChatUsers).not.toHaveBeenCalled();
  });

  it('returns paginated Chat user analytics to an administrator', async () => {
    mockAdminAccess();
    const getChatUsers = vi
      .spyOn(CottiPlatformAnalyticsService.prototype, 'getChatUsers')
      .mockResolvedValue(chatUsers);
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });
    const query = {
      page: 2,
      pageSize: 20,
      q: 'admin',
      range: { days: 30 as const, type: 'preset' as const },
      sortBy: 'recordedCost' as const,
    };

    await expect(caller.platformAnalytics.chatUsers(query)).resolves.toEqual({
      data: chatUsers,
      success: true,
    });
    expect(getChatUsers).toHaveBeenCalledWith(query);
  });

  it('rejects an oversized Chat user page before querying analytics', async () => {
    mockAdminAccess();
    const getChatUsers = vi.spyOn(CottiPlatformAnalyticsService.prototype, 'getChatUsers');
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(caller.platformAnalytics.chatUsers({ pageSize: 51 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(getChatUsers).not.toHaveBeenCalled();
  });

  it('wraps unexpected Chat user analytics errors without exposing internals', async () => {
    mockAdminAccess();
    vi.spyOn(CottiPlatformAnalyticsService.prototype, 'getChatUsers').mockRejectedValue(
      new Error('database details'),
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(caller.platformAnalytics.chatUsers()).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to load COTTI platform Chat user analytics',
    });
  });

  it('rejects an unauthenticated caller before querying analytics', async () => {
    const getDashboard = vi.spyOn(CottiPlatformAnalyticsService.prototype, 'getDashboard');
    const caller = cottiRouter.createCaller({ userId: null });

    await expect(caller.platformAnalytics.dashboard()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(getDashboard).not.toHaveBeenCalled();
  });

  it('rejects a non-admin caller before querying analytics', async () => {
    vi.spyOn(CottiPlatformAdminAccessService.prototype, 'requireAccess').mockRejectedValue(
      new TRPCError({ code: 'FORBIDDEN', message: 'COTTI platform admin access denied' }),
    );
    const getDashboard = vi.spyOn(CottiPlatformAnalyticsService.prototype, 'getDashboard');
    const caller = cottiRouter.createCaller({ userId: 'member-user' });

    await expect(caller.platformAnalytics.dashboard()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(getDashboard).not.toHaveBeenCalled();
  });

  it('returns the dashboard to an administrator with the default range', async () => {
    mockAdminAccess();
    const getDashboard = vi
      .spyOn(CottiPlatformAnalyticsService.prototype, 'getDashboard')
      .mockResolvedValue(dashboard);
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(caller.platformAnalytics.dashboard()).resolves.toEqual({
      data: dashboard,
      success: true,
    });
    expect(getDashboard).toHaveBeenCalledWith(undefined);
  });

  it('passes a valid custom date range to the service', async () => {
    mockAdminAccess();
    const getDashboard = vi
      .spyOn(CottiPlatformAnalyticsService.prototype, 'getDashboard')
      .mockResolvedValue(dashboard);
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });
    const range = { endDate: '2026-08-03', startDate: '2026-08-01', type: 'custom' as const };

    await caller.platformAnalytics.dashboard(range);

    expect(getDashboard).toHaveBeenCalledWith(range);
  });

  it('rejects an overlong custom range before querying analytics', async () => {
    mockAdminAccess();
    const getDashboard = vi.spyOn(CottiPlatformAnalyticsService.prototype, 'getDashboard');
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(
      caller.platformAnalytics.dashboard({
        endDate: '2026-04-01',
        startDate: '2026-01-01',
        type: 'custom',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(getDashboard).not.toHaveBeenCalled();
  });

  it('wraps unexpected service errors without exposing internals', async () => {
    mockAdminAccess();
    vi.spyOn(CottiPlatformAnalyticsService.prototype, 'getDashboard').mockRejectedValue(
      new Error('database details'),
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(caller.platformAnalytics.dashboard()).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to load COTTI platform analytics',
    });
  });

  it('rejects an unauthenticated feature analytics caller before querying', async () => {
    const getFeatures = vi.spyOn(CottiPlatformAnalyticsService.prototype, 'getFeatures');
    const caller = cottiRouter.createCaller({ userId: null });

    await expect(caller.platformAnalytics.features()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(getFeatures).not.toHaveBeenCalled();
  });

  it('returns feature analytics to an administrator', async () => {
    mockAdminAccess();
    const getFeatures = vi
      .spyOn(CottiPlatformAnalyticsService.prototype, 'getFeatures')
      .mockResolvedValue(features);
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });
    const query = { days: 30 as const, type: 'preset' as const };

    await expect(caller.platformAnalytics.features(query)).resolves.toEqual({
      data: features,
      success: true,
    });
    expect(getFeatures).toHaveBeenCalledWith(query);
  });

  it('rejects an overlong feature analytics range before querying', async () => {
    mockAdminAccess();
    const getFeatures = vi.spyOn(CottiPlatformAnalyticsService.prototype, 'getFeatures');
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(
      caller.platformAnalytics.features({
        endDate: '2026-04-01',
        startDate: '2026-01-01',
        type: 'custom',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(getFeatures).not.toHaveBeenCalled();
  });

  it('wraps unexpected feature analytics errors without exposing internals', async () => {
    mockAdminAccess();
    vi.spyOn(CottiPlatformAnalyticsService.prototype, 'getFeatures').mockRejectedValue(
      new Error('database details'),
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(caller.platformAnalytics.features()).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to load COTTI platform feature analytics',
    });
  });
});
