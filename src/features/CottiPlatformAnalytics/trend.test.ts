import { describe, expect, it } from 'vitest';

import type { CottiPlatformAnalyticsTrendItem } from '@/types/cotti/platformAnalytics';

import { buildCottiPlatformAnalyticsTrendData, getCottiPlatformAnalyticsTrendValue } from './trend';

const item: CottiPlatformAnalyticsTrendItem = {
  activeUsers: 12,
  assistantMessages: 32,
  day: '2026-08-03',
  errorMessages: 2,
  errorRate: 0.04,
  realActiveUsers: 10,
  recordedCost: 1.25,
  totalMessages: 50,
  totalTokens: 12_000,
  userMessages: 18,
};

describe('COTTI platform analytics trend', () => {
  it.each([
    ['activeUsers', 12],
    ['totalMessages', 50],
    ['totalTokens', 12_000],
    ['recordedCost', 1.25],
    ['errorRate', 0.04],
  ] as const)('reads %s from a trend item', (metric, expected) => {
    expect(getCottiPlatformAnalyticsTrendValue(item, metric)).toBe(expected);
  });

  it('builds the chart shape with the translated series label', () => {
    expect(buildCottiPlatformAnalyticsTrendData([item], 'totalMessages', '消息数')).toEqual([
      { day: '2026-08-03', 消息数: 50 },
    ]);
  });

  it('builds real and total active-user series together', () => {
    expect(
      buildCottiPlatformAnalyticsTrendData([item], 'activeUsers', '真实活跃', '总活跃'),
    ).toEqual([{ day: '2026-08-03', 真实活跃: 10, 总活跃: 12 }]);
  });
});
