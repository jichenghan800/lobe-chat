import { countContextTokens } from '@lobechat/context-engine';
import { getModelPropertyWithFallback } from '@lobechat/model-runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LobeChatDatabase } from '@/database/type';

import { createContextCostGuard } from './contextCostGuard';

vi.mock('@lobechat/context-engine', () => ({ countContextTokens: vi.fn() }));
vi.mock('@lobechat/model-runtime', () => ({
  getModelPropertyWithFallback: vi.fn(),
  AgentRuntimeError: {
    createError: (_type: string, body: { message: string }) => new Error(body.message),
  },
}));

const freezeStore = vi.hoisted(() => ({ frozen: false, freeze: vi.fn() }));
vi.mock('@/database/models/topicCostFreeze', () => ({
  TopicCostFreezeModel: class {
    async get() {
      return freezeStore.frozen ? { model: 'terra' } : null;
    }
    async freeze(...args: unknown[]) {
      freezeStore.frozen = true;
      freezeStore.freeze(...args);
    }
  },
}));

describe('final context cost guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    freezeStore.frozen = false;
    vi.mocked(getModelPropertyWithFallback).mockImplementation(async (_model, field) =>
      field === 'contextWindowTokens'
        ? 1_050_000
        : {
            units: [
              {
                name: 'textInput',
                strategy: 'tiered',
                tiers: [
                  { rate: 2, upTo: 272_000 },
                  { rate: 4, upTo: 'infinity' },
                ],
              },
            ],
          },
    );
  });

  it('freezes at the early threshold and rejects later short requests and model changes', async () => {
    const scope = { db: {} as LobeChatDatabase, userId: 'owner' };
    vi.mocked(countContextTokens).mockReturnValue({
      rawTotal: 152_320,
      adjustedTotal: 190_400,
    } as ReturnType<typeof countContextTokens>);
    await expect(
      createContextCostGuard('azure', scope).beforeChat!(
        { model: 'terra', messages: [] },
        { metadata: { topicId: 'topic' } },
      ),
    ).rejects.toThrow('冻结');
    expect(freezeStore.freeze).toHaveBeenCalledOnce();
    vi.mocked(countContextTokens).mockReturnValue({ rawTotal: 10, adjustedTotal: 13 } as ReturnType<
      typeof countContextTokens
    >);
    await expect(
      createContextCostGuard('azure', scope).beforeChat!(
        { model: 'other', messages: [] },
        { metadata: { topicId: 'topic' } },
      ),
    ).rejects.toThrow('冻结');
    await expect(
      createContextCostGuard('azure', scope).beforeGenerateObject!(
        {
          model: 'terra',
          messages: [],
          schema: { name: 'test', schema: { type: 'object', properties: {} } },
        },
        { tracing: { topicId: 'topic' } },
      ),
    ).rejects.toThrow('冻结');
  });
  it('retains the per-request guard for unscoped operations', async () => {
    vi.mocked(countContextTokens).mockReturnValue({
      rawTotal: 500_000,
      adjustedTotal: 625_000,
    } as ReturnType<typeof countContextTokens>);
    await expect(
      createContextCostGuard('azure', { db: {} as LobeChatDatabase, userId: 'owner' }).beforeChat!({
        model: 'terra',
        messages: [],
      }),
    ).rejects.toThrow('上下文过大');
    expect(freezeStore.freeze).not.toHaveBeenCalled();
  });
  it('blocks a large final payload before any upstream request', async () => {
    vi.mocked(countContextTokens).mockReturnValue({
      rawTotal: 250_000,
      adjustedTotal: 312_500,
    } as ReturnType<typeof countContextTokens>);
    await expect(
      createContextCostGuard('azure').beforeChat!({ model: 'terra', messages: [] }),
    ).rejects.toThrow('上下文过大');
  });
  it('allows a smaller payload and accounts for tool definitions', async () => {
    vi.mocked(countContextTokens).mockReturnValue({
      rawTotal: 50_000,
      adjustedTotal: 62_500,
    } as ReturnType<typeof countContextTokens>);
    const payload = {
      model: 'terra',
      messages: [{ role: 'user' as const, content: 'hello' }],
      tools: [{ type: 'function' as const, function: { name: 'lookup' } }],
    };
    await expect(createContextCostGuard('azure').beforeChat!(payload)).resolves.toBeUndefined();
    expect(countContextTokens).toHaveBeenCalledWith({
      messages: payload.messages,
      tools: payload.tools,
    });
  });
});
