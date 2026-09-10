import { describe, expect, it } from 'vitest';

import {
  getDefaultCottiPlatformAnalyticsCustomRange,
  normalizeCottiPlatformAnalyticsCustomRange,
  parseCottiPlatformAnalyticsRange,
  toCottiPlatformAnalyticsQuery,
  writeCottiPlatformAnalyticsRange,
} from './range';

describe('COTTI platform analytics range', () => {
  it('uses the seven-day preset by default', () => {
    expect(parseCottiPlatformAnalyticsRange(new URLSearchParams())).toEqual({
      days: 7,
      type: 'preset',
    });
  });

  it('parses a valid custom range', () => {
    const params = new URLSearchParams('range=custom&start=2026-07-01&end=2026-07-29');

    expect(parseCottiPlatformAnalyticsRange(params)).toEqual({
      endDate: '2026-07-29',
      startDate: '2026-07-01',
      type: 'custom',
    });
  });

  it('falls back when preset or custom values are invalid', () => {
    expect(parseCottiPlatformAnalyticsRange(new URLSearchParams('range=365'))).toEqual({
      days: 7,
      type: 'preset',
    });
    expect(
      parseCottiPlatformAnalyticsRange(
        new URLSearchParams('range=custom&start=2026-02-30&end=2026-03-01'),
        new Date('2026-08-03T02:00:00.000Z'),
      ),
    ).toEqual({ endDate: '2026-08-03', startDate: '2026-07-28', type: 'custom' });
  });

  it('builds defaults from the Shanghai calendar date', () => {
    expect(
      getDefaultCottiPlatformAnalyticsCustomRange(new Date('2026-08-02T16:30:00.000Z')),
    ).toEqual({ endDate: '2026-08-03', startDate: '2026-07-28', type: 'custom' });
  });

  it('repairs reversed dates and clamps a custom period to 90 days', () => {
    const initial = { endDate: '2026-08-03', startDate: '2026-07-28', type: 'custom' } as const;

    expect(normalizeCottiPlatformAnalyticsCustomRange(initial, 'startDate', '2026-08-10')).toEqual({
      endDate: '2026-08-10',
      startDate: '2026-08-10',
      type: 'custom',
    });
    expect(normalizeCottiPlatformAnalyticsCustomRange(initial, 'startDate', '2026-01-01')).toEqual({
      endDate: '2026-03-31',
      startDate: '2026-01-01',
      type: 'custom',
    });
  });

  it('updates only analytics range parameters and maps directly to the API query', () => {
    const current = new URLSearchParams('foo=kept&range=7');
    const range = { endDate: '2026-08-03', startDate: '2026-08-01', type: 'custom' } as const;
    const next = writeCottiPlatformAnalyticsRange(current, range);

    expect(next.get('foo')).toBe('kept');
    expect(next.toString()).toBe('foo=kept&range=custom&start=2026-08-01&end=2026-08-03');
    expect(toCottiPlatformAnalyticsQuery(range)).toEqual(range);
  });
});
