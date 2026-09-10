import { describe, expect, it } from 'vitest';

import { shouldWarnLongTopic } from './contextWarning';

describe('long topic reminder', () => {
  it('warns at 100k even for million-token windows', () => {
    expect(shouldWarnLongTopic(99_999, 1_000_000)).toBe(false);
    expect(shouldWarnLongTopic(100_000, 1_000_000)).toBe(true);
    expect(shouldWarnLongTopic(531_353, 1_000_000)).toBe(true);
  });
  it('warns earlier for smaller windows', () => {
    expect(shouldWarnLongTopic(63_999, 128_000)).toBe(false);
    expect(shouldWarnLongTopic(64_000, 128_000)).toBe(true);
  });
  it('handles unknown capacities and ignores empty or invalid estimates', () => {
    expect(shouldWarnLongTopic(100_000, 0)).toBe(true);
    expect(shouldWarnLongTopic(0, 0)).toBe(false);
    expect(shouldWarnLongTopic(Number.NaN, 128_000)).toBe(false);
    expect(shouldWarnLongTopic(-1, 128_000)).toBe(false);
  });
});
