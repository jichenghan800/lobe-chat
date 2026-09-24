// @vitest-environment node
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';

import type { LobeChatDatabase } from '@/database/type';

import { cottiTopicOverviewQuerySchema, CottiTopicOverviewService } from './index';

describe('topic overview query boundaries', () => {
  it('accepts longer search input while retaining a bounded query size', () => {
    expect(cottiTopicOverviewQuerySchema.parse({ q: 'x'.repeat(2048) }).q).toHaveLength(2048);
    expect(cottiTopicOverviewQuerySchema.safeParse({ q: 'x'.repeat(2049) }).success).toBe(false);
  });
  it('excludes soft-deleted topics from both list and detail selection', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    const service = new CottiTopicOverviewService({ execute } as unknown as LobeChatDatabase);
    await service.getDetail('deleted-topic');
    const query = new PgDialect().sqlToQuery(execute.mock.calls[1][0]).sql;
    expect(query).toContain('COALESCE(topics.is_deleted, FALSE) = FALSE');
  });
  it('keeps the actual total when a page is beyond the last result', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: 3 }] });
    const service = new CottiTopicOverviewService({ execute } as unknown as LobeChatDatabase);
    expect((await service.list({ page: 2, pageSize: 20 })).total).toBe(3);
  });
});
