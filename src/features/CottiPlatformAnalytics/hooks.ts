import { useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { isCottiPlatformAnalyticsEnabled } from '@/_custom/registry/platformManagement';
import { useClientDataSWR } from '@/libs/swr';
import { cottiPlatformAnalyticsService } from '@/services/cottiPlatformAnalytics';
import type { CottiPlatformAnalyticsPresetDays } from '@/types/cotti/platformAnalytics';

import type { CottiPlatformAnalyticsRangeSelection } from './range';
import {
  getCottiPlatformAnalyticsRangeMode,
  getDefaultCottiPlatformAnalyticsCustomRange,
  normalizeCottiPlatformAnalyticsCustomRange,
  parseCottiPlatformAnalyticsRange,
  toCottiPlatformAnalyticsQuery,
  writeCottiPlatformAnalyticsRange,
} from './range';

const accessKey = ['cotti', 'platform-admin-access'] as const;

const dashboardKey = (query: ReturnType<typeof toCottiPlatformAnalyticsQuery>) =>
  query.type === 'custom'
    ? (['cotti', 'platform-analytics', 'custom', query.startDate, query.endDate] as const)
    : (['cotti', 'platform-analytics', 'preset', query.days] as const);

export const useCottiPlatformAdminAccess = () => {
  const enabled = isCottiPlatformAnalyticsEnabled();

  return {
    enabled,
    swr: useClientDataSWR(
      enabled ? accessKey : null,
      () => cottiPlatformAnalyticsService.getAccess(),
      { revalidateOnFocus: false },
    ),
  };
};

export const useCottiPlatformAnalyticsRange = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const range = useMemo(() => parseCottiPlatformAnalyticsRange(searchParams), [searchParams]);

  const setRange = (nextRange: CottiPlatformAnalyticsRangeSelection) => {
    setSearchParams(writeCottiPlatformAnalyticsRange(searchParams, nextRange));
  };

  return {
    mode: getCottiPlatformAnalyticsRangeMode(range),
    range,
    setCustomDate: (field: 'endDate' | 'startDate', value: string) => {
      const customRange =
        range.type === 'custom' ? range : getDefaultCottiPlatformAnalyticsCustomRange();
      setRange(normalizeCottiPlatformAnalyticsCustomRange(customRange, field, value));
    },
    setMode: (mode: CottiPlatformAnalyticsPresetDays | 'custom') => {
      setRange(
        mode === 'custom'
          ? getDefaultCottiPlatformAnalyticsCustomRange()
          : { days: mode, type: 'preset' },
      );
    },
  };
};

export const useCottiPlatformAnalyticsDashboard = (
  range: CottiPlatformAnalyticsRangeSelection,
  enabled: boolean,
) => {
  const query = toCottiPlatformAnalyticsQuery(range);

  return useClientDataSWR(
    enabled ? dashboardKey(query) : null,
    () => cottiPlatformAnalyticsService.getDashboard(query),
    { revalidateOnFocus: false },
  );
};
