'use client';

import { formatNumber, formatUsageValue } from '@lobechat/utils';
import { LineChart } from '@lobehub/charts';
import { Block, Empty, Flexbox } from '@lobehub/ui';
import { Segmented, Skeleton, Text } from '@lobehub/ui/base-ui';
import { ActivityIcon } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { CottiPlatformAnalyticsTrendItem } from '@/types/cotti/platformAnalytics';

import { styles } from './style';
import {
  buildCottiPlatformAnalyticsTrendData,
  type CottiPlatformAnalyticsTrendMetric,
} from './trend';

interface TrendSectionProps {
  data?: CottiPlatformAnalyticsTrendItem[];
  loading?: boolean;
  metric: CottiPlatformAnalyticsTrendMetric;
  setMetric: (metric: CottiPlatformAnalyticsTrendMetric) => void;
}

const TrendSection = memo<TrendSectionProps>(({ data, loading, metric, setMetric }) => {
  const { t } = useTranslation('setting');
  const isActiveUsersMetric = metric === 'activeUsers';
  const seriesLabel = isActiveUsersMetric
    ? t('platformAnalytics.trend.series.realActiveUsers')
    : t(`platformAnalytics.trend.metric.${metric}` as const);
  const totalActiveUsersSeriesLabel = t('platformAnalytics.trend.series.totalActiveUsers');
  const chartData = useMemo(
    () =>
      buildCottiPlatformAnalyticsTrendData(
        data ?? [],
        metric,
        seriesLabel,
        isActiveUsersMetric ? totalActiveUsersSeriesLabel : undefined,
      ),
    [data, isActiveUsersMetric, metric, seriesLabel, totalActiveUsersSeriesLabel],
  );
  const hasActivity = (data ?? []).some((item) => item.totalMessages > 0);

  const valueFormatter = (value: number) => {
    if (metric === 'recordedCost')
      return `$${formatNumber(value, value > 0 && value < 0.01 ? 4 : 2)}`;
    if (metric === 'errorRate') return `${formatNumber(value * 100, 2)}%`;
    return formatUsageValue(value);
  };

  return (
    <Block className={styles.section} gap={16} padding={20} variant={'outlined'}>
      <Flexbox horizontal align={'flex-start'} gap={12} justify={'space-between'} wrap={'wrap'}>
        <Flexbox gap={4}>
          <Text fontSize={18} weight={600}>
            {t('platformAnalytics.trend.title')}
          </Text>
          <Text fontSize={13} type={'secondary'}>
            {t('platformAnalytics.trend.desc')}
          </Text>
        </Flexbox>
        <Segmented
          size={'small'}
          value={metric}
          options={[
            {
              label: t('platformAnalytics.trend.metric.activeUsers'),
              value: 'activeUsers',
            },
            {
              label: t('platformAnalytics.trend.metric.totalMessages'),
              value: 'totalMessages',
            },
            {
              label: t('platformAnalytics.trend.metric.totalTokens'),
              value: 'totalTokens',
            },
            {
              label: t('platformAnalytics.trend.metric.recordedCost'),
              value: 'recordedCost',
            },
            {
              label: t('platformAnalytics.trend.metric.errorRate'),
              value: 'errorRate',
            },
          ]}
          onChange={(value) => setMetric(value as CottiPlatformAnalyticsTrendMetric)}
        />
      </Flexbox>
      {loading ? (
        <Skeleton className={styles.chart} />
      ) : hasActivity ? (
        <LineChart
          showGridLines
          className={styles.chart}
          data={chartData}
          height={320}
          index={'day'}
          showLegend={isActiveUsersMetric}
          startEndOnly={(data?.length ?? 0) > 14}
          valueFormatter={valueFormatter}
          categories={
            isActiveUsersMetric ? [seriesLabel, totalActiveUsersSeriesLabel] : [seriesLabel]
          }
        />
      ) : (
        <Empty
          description={t('platformAnalytics.empty.desc')}
          icon={ActivityIcon}
          title={t('platformAnalytics.empty.title')}
        />
      )}
    </Block>
  );
});

TrendSection.displayName = 'TrendSection';

export default TrendSection;
