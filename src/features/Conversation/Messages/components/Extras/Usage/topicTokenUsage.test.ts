import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  formatTopicModelCost,
  getMessageTokenTotal,
  getTopicTokenTotal,
  readSettledTopicUsage,
} from './topicTokenUsage';

describe('native topic token rollup display', () => {
  it('uses the persisted total rather than adding input/output to it again', () => {
    expect(
      getTopicTokenTotal({ totalTokens: 1300, totalInputTokens: 1000, totalOutputTokens: 300 }),
    ).toBe(1300);
  });
  it('falls back to complete input and output counts only', () => {
    expect(getTopicTokenTotal({ totalInputTokens: 1000, totalOutputTokens: 300 })).toBe(1300);
    expect(getTopicTokenTotal({ totalInputTokens: 1000 })).toBeUndefined();
  });
  it('distinguishes missing or invalid usage from measured zero', () => {
    expect(getTopicTokenTotal(null)).toBeUndefined();
    expect(getTopicTokenTotal({ totalTokens: null })).toBeUndefined();
    expect(getTopicTokenTotal({ totalTokens: Number.NaN })).toBeUndefined();
    expect(getTopicTokenTotal({ totalTokens: -1 })).toBeUndefined();
    expect(getTopicTokenTotal({ totalTokens: 0 })).toBe(0);
  });
});

// Regression: a completed answer must not keep the previous round's cached total.
describe('topic usage persistence synchronization', () => {
  afterEach(() => vi.useRealTimers());
  it('waits for the rollup to include the known finalized messages', async () => {
    vi.useFakeTimers();
    const read = vi
      .fn()
      .mockResolvedValueOnce({ totalTokens: 4478 })
      .mockResolvedValue({ totalTokens: 8985 });
    const result = readSettledTopicUsage(read, 8985);
    await vi.advanceTimersByTimeAsync(500);
    await expect(result).resolves.toMatchObject({ totalTokens: 8985 });
    expect(read).toHaveBeenCalledTimes(2);
  });
  it('bounds retries instead of showing stale totals or polling forever', async () => {
    vi.useFakeTimers();
    const read = vi.fn().mockResolvedValue({ totalTokens: 4478 });
    const result = expect(readSettledTopicUsage(read, 8985)).rejects.toThrow('not synchronized');
    await vi.advanceTimersByTimeAsync(1500);
    await result;
    expect(read).toHaveBeenCalledTimes(4);
  });
  it('uses one read for already synchronized or unavailable topics', async () => {
    const read = vi.fn().mockResolvedValue({ totalTokens: 8985 });
    await expect(readSettledTopicUsage(read, 4507)).resolves.toMatchObject({ totalTokens: 8985 });
    expect(read).toHaveBeenCalledTimes(1);
    await expect(readSettledTopicUsage(async () => null, 4507)).resolves.toBeNull();
  });
});

// Regression: the last streamed answer has metadata.usage until a page reload.
describe('live and persisted message usage', () => {
  it('includes the newly completed reply in the synchronization minimum', () => {
    const messages = [
      { usage: { totalTokens: 4478 } },
      { usage: { totalTokens: 4507 } },
      { metadata: { usage: { totalTokens: 4535 }, totalTokens: 4535 } },
    ];
    expect(messages.reduce((sum, message) => sum + (getMessageTokenTotal(message) ?? 0), 0)).toBe(
      13520,
    );
  });
  it('prefers persisted usage and never adds duplicate or cache buckets', () => {
    expect(
      getMessageTokenTotal({
        usage: { totalTokens: 50, inputCachedTokens: 30 },
        metadata: { usage: { totalTokens: 40 }, totalTokens: 40 },
      }),
    ).toBe(50);
    expect(getMessageTokenTotal({ usage: { totalTokens: 0 }, metadata: { totalTokens: 40 } })).toBe(
      0,
    );
  });
  it('supports legacy flattened metadata and rejects unrecorded counts', () => {
    expect(
      getMessageTokenTotal({ metadata: { totalInputTokens: 40, totalOutputTokens: 10 } }),
    ).toBe(50);
    expect(getMessageTokenTotal({ metadata: { totalTokens: '50' } })).toBeUndefined();
    expect(getMessageTokenTotal({})).toBeUndefined();
  });
});

describe('recorded model cost display', () => {
  it('converts recorded USD with the fixed display rate and retains small amounts', () => {
    expect(formatTopicModelCost({ totalUSD: 1, calls: 1, pricedCalls: 1 })).toBe('¥7.12');
    expect(formatTopicModelCost({ totalUSD: 0.000001, calls: 1, pricedCalls: 1 })).toBe('<¥0.0001');
  });
  it('does not turn missing prices into free calls', () => {
    expect(formatTopicModelCost({ totalUSD: null, calls: 2, pricedCalls: 0 })).toBeUndefined();
    expect(formatTopicModelCost({ totalUSD: 0, calls: 1, pricedCalls: 1 })).toBe('¥0.00');
    expect(formatTopicModelCost(undefined)).toBeUndefined();
  });
});
