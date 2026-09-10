// @vitest-environment node
import { cottiLoginAccessRules, topics, users } from '@lobechat/database/schemas';
import { getTestDB } from '@lobechat/database/test-utils';
import { inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { LobeChatDatabase } from '@/database/type';

import { CottiTopicOverviewService } from './index';

vi.mock('@/server/services/file', () => ({
  FileService: class {
    getFileAccessUrl({ url }: { url: string }) {
      return url;
    }
  },
}));

describe('administrator overview includes every account', () => {
  let db: LobeChatDatabase;
  let service: CottiTopicOverviewService;
  const prefix = `overview-${Date.now()}`;
  const ids = ['regular', 'allowlisted', 'admin'].map((role) => `${prefix}-${role}`);

  beforeAll(async () => {
    db = await getTestDB();
    service = new CottiTopicOverviewService(db);
    await db.insert(users).values(
      ids.map((id, i) => ({
        id,
        email: `${id}@example.com`,
        role: i === 2 ? 'admin' : 'user',
      })),
    );
    await db.insert(cottiLoginAccessRules).values({
      type: 'email',
      value: `${ids[1]}@example.com`,
      enabled: true,
    });
    await db.insert(topics).values(
      ids.flatMap((userId, index) =>
        Array.from({ length: 8 }, (_, i) => ({
          userId,
          title: `${prefix} ${index}-${i}`,
          description: i === 0 ? '询问助手能力' : null,
        })),
      ),
    );
    await db.insert(topics).values({ userId: ids[0], title: `${prefix} deleted`, isDeleted: true });
    await db.insert(topics).values({ userId: ids[0], title: `${prefix} 100%_literal` });
  }, 60_000);

  afterAll(async () => {
    vi.unstubAllEnvs();
    await db
      .delete(cottiLoginAccessRules)
      .where(inArray(cottiLoginAccessRules.value, [`${ids[1]}@example.com`]));
    await db.delete(users).where(inArray(users.id, ids));
  });

  it('searches across regular, login-allowlisted and administrator accounts', async () => {
    vi.stubEnv('AUTH_ALLOWED_EMAILS', `${ids[1]}@example.com`);
    const result = await service.list({ q: '询问助手能力' });
    expect(result.items.map((item) => item.userId).sort()).toEqual([...ids].sort());
    const detail = await service.getDetail(result.items.find((item) => item.userId === ids[1])!.id);
    expect(detail?.userId).toBe(ids[1]);
  });

  it('paginates all matching topics without dropping users and retains out-of-range totals', async () => {
    const first = await service.list({ q: prefix, page: 1, pageSize: 20 });
    const second = await service.list({ q: prefix, page: 2, pageSize: 20 });
    expect(first.total).toBe(25);
    expect(first.items).toHaveLength(20);
    expect(second.items).toHaveLength(5);
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(25);
    expect((await service.list({ q: prefix, page: 3, pageSize: 20 })).total).toBe(25);
  });

  it('treats search wildcard characters literally', async () => {
    const result = await service.list({ q: '100%_literal' });
    expect(result.total).toBe(1);
    expect(result.items[0].title).toBe(`${prefix} 100%_literal`);
  });
});
