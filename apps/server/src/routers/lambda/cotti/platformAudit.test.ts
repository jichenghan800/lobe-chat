// @vitest-environment node
import { TRPCError } from '@trpc/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CottiPlatformAdminAccessService } from '@/server/services/cotti/adminAccess';
import { CottiPlatformAuditService } from '@/server/services/cotti/platformAudit';

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

describe('cotti.platformAudit router', () => {
  it('rejects a caller without platform administrator access', async () => {
    vi.spyOn(CottiPlatformAdminAccessService.prototype, 'requireAccess').mockRejectedValue(
      new TRPCError({ code: 'FORBIDDEN', message: 'denied' }),
    );
    const getDashboard = vi.spyOn(CottiPlatformAuditService.prototype, 'getDashboard');
    const caller = cottiRouter.createCaller({ userId: 'member-user' });

    await expect(caller.platformAudit.dashboard()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(getDashboard).not.toHaveBeenCalled();
  });

  it('loads the paginated dashboard through the shared admin procedure', async () => {
    const dashboard = {
      items: [],
      overview: {
        agentMessages: 0,
        attachmentMessages: 0,
        chatMessages: 0,
        highRiskMessages: 0,
        searchMessages: 0,
        taskMessages: 0,
        toolMessages: 0,
        totalMessages: 0,
      },
      page: 2,
      pageSize: 50 as const,
      query: {
        feature: 'agent' as const,
        page: 2,
        pageSize: 50 as const,
        range: 30 as const,
        riskLevel: 'high' as const,
      },
      total: 0,
    };
    const getDashboard = vi
      .spyOn(CottiPlatformAuditService.prototype, 'getDashboard')
      .mockResolvedValue(dashboard);
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(
      caller.platformAudit.dashboard({
        feature: 'agent',
        page: 2,
        pageSize: 50,
        range: 30,
        riskLevel: 'high',
      }),
    ).resolves.toEqual({ data: dashboard, success: true });
    expect(getDashboard).toHaveBeenCalledWith({
      feature: 'agent',
      page: 2,
      pageSize: 50,
      range: 30,
      riskLevel: 'high',
    });
  });

  it('records the administrator identity whenever original prompt detail is returned', async () => {
    const detail = {
      attachments: [],
      content: 'sensitive prompt',
      createdAt: new Date().toISOString(),
      fileCount: 0,
      id: 'message-1',
      mode: 'chat' as const,
      riskFlags: [],
      riskLevel: 'none' as const,
      search: false,
      tool: false,
      userId: 'target-user',
    };
    vi.spyOn(CottiPlatformAuditService.prototype, 'getMessageDetail').mockResolvedValue(detail);
    const recordMessageView = vi
      .spyOn(CottiPlatformAuditService.prototype, 'recordMessageView')
      .mockResolvedValue(undefined);
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(caller.platformAudit.messageDetail({ messageId: 'message-1' })).resolves.toEqual({
      data: detail,
      success: true,
    });
    expect(recordMessageView).toHaveBeenCalledWith({
      adminEmail: 'admin@example.com',
      adminUserId: 'admin-user',
      metadata: { source: 'cotti-platform-management' },
      target: detail,
    });
  });

  it('does not write a view log when the target prompt does not exist', async () => {
    vi.spyOn(CottiPlatformAuditService.prototype, 'getMessageDetail').mockResolvedValue(undefined);
    const recordMessageView = vi.spyOn(CottiPlatformAuditService.prototype, 'recordMessageView');
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(
      caller.platformAudit.messageDetail({ messageId: 'missing' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(recordMessageView).not.toHaveBeenCalled();
  });

  it('passes the administrator identity to an explicit risk analysis request', async () => {
    const analysis = {
      evidence: [],
      riskLabels: [],
      riskLevel: 'none' as const,
      status: 'completed' as const,
    };
    const analyzeMessageRisk = vi
      .spyOn(CottiPlatformAuditService.prototype, 'analyzeMessageRisk')
      .mockResolvedValue(analysis);
    const caller = cottiRouter.createCaller({ userId: 'admin-user' });

    await expect(
      caller.platformAudit.analyzeMessageRisk({ force: true, messageId: 'message-1' }),
    ).resolves.toMatchObject({ data: analysis, success: true });
    expect(analyzeMessageRisk).toHaveBeenCalledWith({
      adminEmail: 'admin@example.com',
      adminUserId: 'admin-user',
      force: true,
      messageId: 'message-1',
    });
  });
});
