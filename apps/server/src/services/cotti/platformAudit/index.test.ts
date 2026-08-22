// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import type { LobeChatDatabase } from '@/database/type';

import { CottiPlatformAuditService, parseCottiPlatformAuditExcludedEmails } from './index';

const createDatabase = (...results: Array<{ rows: unknown[] }>) =>
  ({
    execute: vi.fn().mockImplementation(() => Promise.resolve(results.shift())),
  }) as unknown as LobeChatDatabase;

describe('CottiPlatformAuditService', () => {
  it('deduplicates exact environment emails without expanding domain rules', () => {
    expect(
      parseCottiPlatformAuditExcludedEmails(
        'Admin@Example.com,*',
        'example.com, Member@Example.com;admin@example.com',
      ),
    ).toEqual(['admin@example.com', 'member@example.com']);
  });

  it('keeps Chat mode even when the historical message has an agent id', async () => {
    const db = createDatabase(
      {
        rows: [
          {
            agentMessages: 0,
            attachmentMessages: 0,
            chatMessages: 1,
            highRiskMessages: 0,
            searchMessages: 0,
            taskMessages: 0,
            toolMessages: 0,
            totalMessages: 1,
          },
        ],
      },
      {
        rows: [
          {
            agentId: 'agt_historical',
            createdAt: '2026-08-22T00:00:00.000Z',
            fileCount: 0,
            id: 'message-1',
            mode: 'chat',
            model: 'gpt-5.6-terra',
            provider: 'azure',
            search: false,
            sessionId: 'session-1',
            sessionTitle: 'Chat conversation',
            tool: false,
            userEmail: 'member@example.com',
            userId: 'user-1',
            userName: 'Member',
          },
        ],
      },
    );

    const dashboard = await new CottiPlatformAuditService(db).getDashboard({ riskLevel: 'all' });

    expect(dashboard.items[0]).toMatchObject({
      agentId: 'agt_historical',
      mode: 'chat',
      model: 'gpt-5.6-terra',
      provider: 'azure',
    });
    expect(dashboard.overview).toMatchObject({ agentMessages: 0, chatMessages: 1 });
  });

  it('returns attachment metadata and applies extracted text to detail risk signals', async () => {
    const db = createDatabase({
      rows: [
        {
          agentId: 'agt_1',
          attachments: [
            {
              documentId: 'doc-1',
              extractedTextPreview: '员工手机号属于个人信息',
              fileType: 'application/pdf',
              id: 'file-1',
              name: '员工资料.pdf',
              size: 2048,
            },
          ],
          content: '请汇总附件',
          contentPreview: '请汇总附件',
          createdAt: '2026-08-22T00:00:00.000Z',
          fileCount: 1,
          id: 'message-1',
          mode: 'agent',
          model: 'gemini-3.6-flash',
          provider: 'vertexai',
          search: false,
          tool: true,
          userEmail: 'member@example.com',
          userId: 'user-1',
          userName: 'Member',
        },
      ],
    });

    const detail = await new CottiPlatformAuditService(db).getMessageDetail('message-1');

    expect(detail?.attachments).toEqual([
      expect.objectContaining({ id: 'file-1', name: '员工资料.pdf', size: 2048 }),
    ]);
    expect(detail?.riskFlags.map((flag) => flag.key)).toEqual(
      expect.arrayContaining(['attachment', 'personal', 'tool_call']),
    );
  });

  it('records attachment ids and count without copying attachment content into view logs', async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const db = { insert: vi.fn(() => ({ values })) } as unknown as LobeChatDatabase;
    const service = new CottiPlatformAuditService(db);

    await service.recordMessageView({
      adminUserId: 'admin-1',
      metadata: { source: 'test' },
      target: {
        attachments: [
          {
            extractedTextPreview: 'sensitive attachment text',
            fileType: 'text/plain',
            id: 'file-1',
            name: 'private.txt',
            size: 128,
          },
        ],
        createdAt: '2026-08-22T00:00:00.000Z',
        fileCount: 1,
        id: 'message-1',
        mode: 'chat',
        riskFlags: [],
        riskLevel: 'low',
        search: false,
        tool: false,
        userId: 'user-1',
      },
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { attachmentCount: 1, attachmentIds: ['file-1'], source: 'test' },
      }),
    );
    expect(JSON.stringify(values.mock.calls[0][0])).not.toContain('sensitive attachment text');
    expect(JSON.stringify(values.mock.calls[0][0])).not.toContain('private.txt');
  });
});
