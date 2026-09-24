import { countContextTokens } from '@lobechat/context-engine';
import type * as ModelRuntime from '@lobechat/model-runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LobeChatDatabase } from '@/database/type';

import { createContextCostGuard, estimateTopicRequestCost } from './contextCostGuard';

const budgetCheck = vi.hoisted(() => vi.fn());
vi.mock('@/database/models/cottiTopicBudget', () => ({
  CottiTopicBudgetModel: class {
    freezeIfExceeded = budgetCheck;
  },
}));

vi.mock('@lobechat/context-engine', () => ({ countContextTokens: vi.fn() }));
vi.mock('@lobechat/model-runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof ModelRuntime>()),
  getModelPricing: vi.fn(async () => ({
    units: [
      { name: 'textInput', rate: 2, strategy: 'fixed', unit: 'millionTokens' },
      { name: 'textOutput', rate: 12, strategy: 'fixed', unit: 'millionTokens' },
    ],
  })),
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
    budgetCheck.mockReset();
  });

  it.each([
    ['azure', 'gpt-5.6-terra', 190_400],
    ['vertexai', 'gemini-3.8-flash', 1_000_000],
  ])(
    'uses monetary reservation without length freezing for %s/%s',
    async (provider, model, total) => {
      const scope = { db: {} as LobeChatDatabase, userId: 'owner' };
      vi.mocked(countContextTokens).mockReturnValue({
        rawTotal: total / 1.25,
        adjustedTotal: total,
      } as ReturnType<typeof countContextTokens>);
      const guard = createContextCostGuard(provider, scope);
      await expect(
        guard.beforeChat!({ model, messages: [] }, { metadata: { topicId: 'topic' } }),
      ).resolves.toBeUndefined();
      await expect(
        guard.beforeGenerateObject!(
          {
            model,
            messages: [],
            schema: { name: 'summary', schema: { type: 'object', properties: {} } },
          },
          { tracing: { topicId: 'topic' } },
        ),
      ).resolves.toBeUndefined();
      expect(freezeStore.freeze).not.toHaveBeenCalled();
      expect(budgetCheck).toHaveBeenLastCalledWith('owner', 'topic', expect.any(Number));
      expect(budgetCheck.mock.lastCall?.[2]).toBeGreaterThan(0);
    },
  );
  it('still rejects a manually frozen topic before sending', async () => {
    freezeStore.frozen = true;
    await expect(
      createContextCostGuard('azure', { db: {} as LobeChatDatabase, userId: 'owner' }).beforeChat!(
        { model: 'terra', messages: [] },
        { metadata: { topicId: 'topic' } },
      ),
    ).rejects.toThrow('冻结');
    expect(countContextTokens).not.toHaveBeenCalled();
  });
  it('blocks before sending when the next request would exhaust the remaining budget', async () => {
    vi.mocked(countContextTokens).mockReturnValue({
      rawTotal: 100,
      adjustedTotal: 125,
    } as ReturnType<typeof countContextTokens>);
    budgetCheck.mockImplementation(async (_user, _topic, nextCost) => {
      if (nextCost > 0) freezeStore.frozen = true;
    });
    await expect(
      createContextCostGuard('azure', { db: {} as LobeChatDatabase, userId: 'owner' }).beforeChat!(
        { model: 'gpt-5.6-terra', messages: [], max_tokens: 1000 },
        { metadata: { topicId: 'topic' } },
      ),
    ).rejects.toThrow('预算');
    expect(budgetCheck).toHaveBeenLastCalledWith('owner', 'topic', 0.01225);
  });
  it('blocks short requests once recorded spending reaches the limit', async () => {
    budgetCheck.mockImplementation(async () => {
      freezeStore.frozen = true;
    });
    await expect(
      createContextCostGuard('vertexai', { db: {} as LobeChatDatabase, userId: 'owner' })
        .beforeChat!(
        { model: 'gemini-3.8-flash', messages: [] },
        { metadata: { topicId: 'topic' } },
      ),
    ).rejects.toThrow('冻结');
    expect(countContextTokens).not.toHaveBeenCalled();
  });
  it('does not impose a custom length limit without a topic', async () => {
    vi.mocked(countContextTokens).mockReturnValue({
      rawTotal: 500_000,
      adjustedTotal: 625_000,
    } as ReturnType<typeof countContextTokens>);
    await expect(
      createContextCostGuard('azure', { db: {} as LobeChatDatabase, userId: 'owner' }).beforeChat!({
        model: 'terra',
        messages: [],
      }),
    ).resolves.toBeUndefined();
    expect(freezeStore.freeze).not.toHaveBeenCalled();
  });
  it('leaves unscoped large payloads to native context handling', async () => {
    vi.mocked(countContextTokens).mockReturnValue({
      rawTotal: 250_000,
      adjustedTotal: 312_500,
    } as ReturnType<typeof countContextTokens>);
    await expect(
      createContextCostGuard('azure').beforeChat!({ model: 'terra', messages: [] }),
    ).resolves.toBeUndefined();
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

describe('topic request budget estimate', () => {
  const pricing = {
    units: [
      {
        name: 'textInput' as const,
        rate: 2,
        strategy: 'fixed' as const,
        unit: 'millionTokens' as const,
      },
      {
        name: 'textInput_cacheRead' as const,
        rate: 0.2,
        strategy: 'fixed' as const,
        unit: 'millionTokens' as const,
      },
      {
        name: 'textInput_cacheWrite' as const,
        rate: 2.5,
        strategy: 'fixed' as const,
        unit: 'millionTokens' as const,
      },
      {
        name: 'textOutput' as const,
        rate: 12,
        strategy: 'fixed' as const,
        unit: 'millionTokens' as const,
      },
    ],
  };
  it('reserves cache write instead of assuming a hit, without charging input twice', () => {
    expect(estimateTopicRequestCost(pricing, 100000, 1000)).toBeCloseTo(0.262);
    expect(estimateTopicRequestCost(pricing, 100000)).toBeCloseTo(0.348304);
  });
  it('reserves the highest listed cache TTL rate when request TTL is unknown', () => {
    const ttlPricing = {
      units: pricing.units.map((unit) =>
        unit.name === 'textInput_cacheWrite'
          ? {
              name: unit.name,
              strategy: 'lookup' as const,
              unit: 'millionTokens' as const,
              lookup: { prices: { '5m': 2.5, '1h': 4 }, pricingParams: ['ttl'] },
            }
          : unit,
      ),
    };
    expect(estimateTopicRequestCost(ttlPricing, 100_000, 1000)).toBeCloseTo(0.412);
    expect(ttlPricing.units.find((unit) => unit.name === 'textInput_cacheWrite')?.strategy).toBe(
      'lookup',
    );
  });
  it('keeps an empty cache lookup unavailable instead of assuming free writes', () => {
    expect(
      estimateTopicRequestCost(
        {
          units: [
            ...pricing.units.filter((unit) => unit.name !== 'textInput_cacheWrite'),
            {
              name: 'textInput_cacheWrite',
              strategy: 'lookup',
              unit: 'millionTokens',
              lookup: { prices: {}, pricingParams: ['ttl'] },
            },
          ],
        },
        100,
        100,
      ),
    ).toBeUndefined();
  });
  it('never treats a missing price as free', () => {
    expect(estimateTopicRequestCost(undefined, 100)).toBeUndefined();
    expect(estimateTopicRequestCost({ units: [] }, 100)).toBeUndefined();
  });
});
