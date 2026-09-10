import { describe, expect, it } from 'vitest';

import {
  cottiPlatformAnalyticsQuerySchema,
  listCottiPlatformAnalyticsDays,
  resolveCottiPlatformAnalyticsPeriod,
} from './range';

describe('COTTI platform analytics range', () => {
  it('defaults to the latest seven Shanghai calendar days and ends at now', () => {
    const now = new Date('2026-08-03T04:30:00.000Z');

    expect(resolveCottiPlatformAnalyticsPeriod(undefined, now)).toMatchObject({
      endAt: '2026-08-03T04:30:00.000Z',
      endDate: '2026-08-03',
      presetDays: 7,
      startAt: '2026-07-27T16:00:00.000Z',
      startDate: '2026-07-28',
      timezone: 'Asia/Shanghai',
      type: 'preset',
    });
  });

  it('uses Shanghai rather than UTC when resolving the current day', () => {
    const period = resolveCottiPlatformAnalyticsPeriod(
      { days: 1, type: 'preset' },
      new Date('2026-08-02T16:30:00.000Z'),
    );

    expect(period).toMatchObject({
      endDate: '2026-08-03',
      startAt: '2026-08-02T16:00:00.000Z',
      startDate: '2026-08-03',
    });
  });

  it('turns an inclusive custom date range into half-open UTC boundaries', () => {
    const period = resolveCottiPlatformAnalyticsPeriod(
      { endDate: '2026-08-03', startDate: '2026-08-01', type: 'custom' },
      new Date('2026-08-04T01:00:00.000Z'),
    );

    expect(period).toMatchObject({
      endAt: '2026-08-03T16:00:00.000Z',
      endDate: '2026-08-03',
      startAt: '2026-07-31T16:00:00.000Z',
      startDate: '2026-08-01',
      type: 'custom',
    });
  });

  it('rejects invalid, reversed, and overlong custom ranges', () => {
    expect(
      cottiPlatformAnalyticsQuerySchema.safeParse({
        endDate: '2026-02-30',
        startDate: '2026-02-01',
        type: 'custom',
      }).success,
    ).toBe(false);
    expect(
      cottiPlatformAnalyticsQuerySchema.safeParse({
        endDate: '2026-08-01',
        startDate: '2026-08-02',
        type: 'custom',
      }).success,
    ).toBe(false);
    expect(
      cottiPlatformAnalyticsQuerySchema.safeParse({
        endDate: '2026-04-01',
        startDate: '2026-01-01',
        type: 'custom',
      }).success,
    ).toBe(false);
  });

  it('lists every day in the inclusive display range', () => {
    expect(listCottiPlatformAnalyticsDays('2026-08-01', '2026-08-03')).toEqual([
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
    ]);
  });
});
