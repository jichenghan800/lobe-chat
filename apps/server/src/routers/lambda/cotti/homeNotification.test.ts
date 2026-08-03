// @vitest-environment node
import { TRPCError } from '@trpc/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CottiPlatformAdminAccessService } from '@/server/services/cotti/adminAccess';

import { cottiRouter } from './index';

const mocks = vi.hoisted(() => ({
  CottiHomeNotificationModel: vi.fn(),
  getConfig: vi.fn(),
  updateConfig: vi.fn(),
}));

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(async () => ({})),
}));

vi.mock('@/database/models/cottiHomeNotification', () => ({
  CottiHomeNotificationModel: mocks.CottiHomeNotificationModel,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.CottiHomeNotificationModel.mockImplementation(() => ({
    getConfig: mocks.getConfig,
    updateConfig: mocks.updateConfig,
  }));
  mocks.getConfig.mockResolvedValue({ content: '当前通知', enabled: true });
  mocks.updateConfig.mockResolvedValue({ content: '更新通知', enabled: false });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('cotti.homeNotification router', () => {
  it('allows an unauthenticated caller to read the current notification', async () => {
    const requireAccess = vi.spyOn(CottiPlatformAdminAccessService.prototype, 'requireAccess');
    const caller = cottiRouter.createCaller({ userId: null });

    await expect(caller.homeNotification.detail()).resolves.toEqual({
      data: { content: '当前通知', enabled: true },
      success: true,
    });
    expect(requireAccess).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated update', async () => {
    const caller = cottiRouter.createCaller({ userId: null });

    await expect(
      caller.homeNotification.update({ content: '更新通知', enabled: false }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(mocks.updateConfig).not.toHaveBeenCalled();
  });

  it('rejects an update from a non-admin user', async () => {
    vi.spyOn(CottiPlatformAdminAccessService.prototype, 'requireAccess').mockRejectedValue(
      new TRPCError({ code: 'FORBIDDEN', message: 'COTTI platform admin access denied' }),
    );
    const caller = cottiRouter.createCaller({ userId: 'member-user' });

    await expect(
      caller.homeNotification.update({ content: '更新通知', enabled: false }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mocks.updateConfig).not.toHaveBeenCalled();
  });

  it('updates the notification and records the administrator', async () => {
    vi.spyOn(CottiPlatformAdminAccessService.prototype, 'requireAccess').mockResolvedValue({
      email: 'admin@example.com',
      normalizedEmail: 'admin@example.com',
      source: 'email_allowlist',
      userId: 'admin-user',
    });
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(
      caller.homeNotification.update({ content: '更新通知', enabled: false }),
    ).resolves.toEqual({
      data: { content: '更新通知', enabled: false },
      message: 'COTTI home notification updated',
      success: true,
    });
    expect(mocks.updateConfig).toHaveBeenCalledWith(
      { content: '更新通知', enabled: false },
      'admin-user',
    );
  });

  it('rejects content longer than 500 characters', async () => {
    vi.spyOn(CottiPlatformAdminAccessService.prototype, 'requireAccess').mockResolvedValue({
      email: 'admin@example.com',
      normalizedEmail: 'admin@example.com',
      source: 'email_allowlist',
      userId: 'admin-user',
    });
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(
      caller.homeNotification.update({ content: 'a'.repeat(501), enabled: true }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(mocks.updateConfig).not.toHaveBeenCalled();
  });
});
