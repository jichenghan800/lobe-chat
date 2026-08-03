import type { CottiPlatformAnalyticsTrendItem } from '@/types/cotti/platformAnalytics';

export type CottiPlatformAnalyticsTrendMetric =
  'activeUsers' | 'errorRate' | 'recordedCost' | 'totalMessages' | 'totalTokens';

export const getCottiPlatformAnalyticsTrendValue = (
  item: CottiPlatformAnalyticsTrendItem,
  metric: CottiPlatformAnalyticsTrendMetric,
) => item[metric];

export const buildCottiPlatformAnalyticsTrendData = (
  items: CottiPlatformAnalyticsTrendItem[],
  metric: CottiPlatformAnalyticsTrendMetric,
  seriesLabel: string,
) =>
  items.map((item) => ({
    day: item.day,
    [seriesLabel]: getCottiPlatformAnalyticsTrendValue(item, metric),
  }));
