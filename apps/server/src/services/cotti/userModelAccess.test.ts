// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LobeChatDatabase } from '@/database/type';

import { assertCottiAgentAllowed, createUserModelAccessGuard } from './userModelAccess';

const mocks = vi.hoisted(() => ({ get: vi.fn(), getConfig: vi.fn(), allows: vi.fn() }));
vi.mock('@/database/models/cottiUserGroup', () => ({
  CottiUserGroupModel: class {
    allows = mocks.allows;
  },
}));
vi.mock('@/database/models/cottiUserPolicy', () => ({
  CottiUserPolicyModel: class {
    get = mocks.get;
  },
}));
vi.mock('@/database/models/cottiModelDisplay', () => ({
  CottiModelDisplayModel: class {
    getUserConfig = mocks.getConfig;
  },
}));
const db = {} as LobeChatDatabase;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.allows.mockResolvedValue(true);
  mocks.get.mockResolvedValue({ vip: false, agentEnabled: false });
  mocks.getConfig.mockResolvedValue({
    chat: [{ provider: 'azure', model: 'premium', enabled: true, vip: true }],
    agent: [],
  });
});
describe('server-side user permissions', () => {
  it('rejects VIP models for ordinary users in chat and structured calls including existing topics', async () => {
    const hooks = createUserModelAccessGuard('azure', { db, userId: 'member' });
    await expect(
      hooks.beforeChat!({ model: 'premium', messages: [] }, { metadata: { topicId: 'old-topic' } }),
    ).rejects.toBeDefined();
    await expect(
      hooks.beforeGenerateObject!({ model: 'premium', messages: [] }),
    ).rejects.toBeDefined();
    await expect(hooks.beforeChat!({ model: 'ordinary', messages: [] })).resolves.toBeUndefined();
  });
  it('keeps VIP and Agent independent and rereads revocation on each step', async () => {
    mocks.get.mockResolvedValue({ vip: true, agentEnabled: false });
    await expect(
      createUserModelAccessGuard('azure', { db, userId: 'member' }).beforeChat!({
        model: 'premium',
        messages: [],
      }),
    ).resolves.toBeUndefined();
    await expect(assertCottiAgentAllowed(db, 'member')).rejects.toBeDefined();
    mocks.get.mockResolvedValue({ vip: false, agentEnabled: true });
    await expect(assertCottiAgentAllowed(db, 'member')).resolves.toBeUndefined();
    mocks.get.mockResolvedValue({ vip: false, agentEnabled: false });
    await expect(assertCottiAgentAllowed(db, 'member')).rejects.toBeDefined();
  });
});

describe('channel group enforcement', () => {
  it('rejects other channels before chat, structured output, image, video and embeddings', async () => {
    mocks.allows.mockResolvedValue(false);
    const hooks = createUserModelAccessGuard('azure', { db, userId: 'pressure-user' });
    for (const hook of [
      hooks.beforeChat,
      hooks.beforeGenerateObject,
      hooks.beforeCreateImage,
      hooks.beforeCreateVideo,
      hooks.beforeEmbeddings,
    ]) {
      await expect(
        (hook as (p: { model: string }) => Promise<void>)({ model: 'gpt-5.6-sol' }),
      ).rejects.toBeDefined();
    }
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it('checks membership changes on every call on a cached runtime', async () => {
    const hooks = createUserModelAccessGuard('openai', { db, userId: 'pressure-user' });
    await expect(
      hooks.beforeChat!({ model: 'gpt-5.6-sol', messages: [] }),
    ).resolves.toBeUndefined();
    mocks.allows.mockResolvedValue(false);
    await expect(hooks.beforeChat!({ model: 'gpt-5.6-sol', messages: [] })).rejects.toBeDefined();
  });
});
