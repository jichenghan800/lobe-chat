import type { ChatMethodOptions } from '@lobechat/model-runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LobeChatDatabase } from '@/database/type';
import { initModelRuntimeFromDB } from '@/server/modules/ModelRuntime';

import { summarizeContinuationFragment } from './topicContinuation';

vi.mock('@/server/modules/ModelRuntime', () => ({ initModelRuntimeFromDB: vi.fn() }));
const chat = vi.fn();
const input = { model: 'terra', provider: 'azure', text: 'budget 123', previous: '' };
describe('bounded frozen-topic handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(initModelRuntimeFromDB).mockResolvedValue({ chat } as unknown as Awaited<
      ReturnType<typeof initModelRuntimeFromDB>
    >);
    chat.mockImplementation(async (_payload, options: ChatMethodOptions) => {
      await options.callback?.onText?.('Keep budget 123');
      return new Response('');
    });
  });
  it('uses a small tool-free call outside the frozen topic and forwards cancellation', async () => {
    const controller = new AbortController();
    expect(
      await summarizeContinuationFragment({} as LobeChatDatabase, 'user', input, controller.signal),
    ).toBe('Keep budget 123');
    const [payload, options] = chat.mock.calls[0];
    expect(payload.max_tokens).toBe(4096);
    expect(payload.tools).toBeUndefined();
    expect(options.metadata).not.toHaveProperty('topicId');
    expect(options.signal).toBe(controller.signal);
  });
  it('rejects oversized fragments before initializing any provider', async () => {
    await expect(
      summarizeContinuationFragment({} as LobeChatDatabase, 'user', {
        ...input,
        text: 'a'.repeat(32_001),
      }),
    ).rejects.toThrow('too large');
    await expect(
      summarizeContinuationFragment({} as LobeChatDatabase, 'user', {
        ...input,
        previous: 'a'.repeat(24_001),
      }),
    ).rejects.toThrow('too large');
    expect(initModelRuntimeFromDB).not.toHaveBeenCalled();
  });
  it('rejects an empty summary without creating a misleading continuation', async () => {
    chat.mockResolvedValue(new Response(''));
    await expect(
      summarizeContinuationFragment({} as LobeChatDatabase, 'user', input),
    ).rejects.toThrow('Invalid handoff');
  });
});
