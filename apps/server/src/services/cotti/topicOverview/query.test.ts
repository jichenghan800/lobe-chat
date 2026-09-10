// @vitest-environment node
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';

import type { LobeChatDatabase } from '@/database/type';

import { CottiTopicOverviewService } from './index';

describe('topic overview query boundaries', () => {
  it('excludes soft-deleted topics from both list and detail selection', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    const service = new CottiTopicOverviewService({ execute } as unknown as LobeChatDatabase);
    await service.getDetail('deleted-topic');
    const query = new PgDialect().sqlToQuery(execute.mock.calls[0][0]).sql;
    expect(query).toContain('COALESCE(topics.is_deleted, FALSE) = FALSE');
  });
  it('keeps the actual total when a page is beyond the last result', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: 3 }] });
    const service = new CottiTopicOverviewService({ execute } as unknown as LobeChatDatabase);
    expect((await service.list({ page: 2, pageSize: 20 })).total).toBe(3);
  });
});
