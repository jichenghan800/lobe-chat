'use client';

import { formatNumber, formatUsageValue } from '@lobechat/utils';
import {
  CircleDollarSignIcon,
  MessageSquareTextIcon,
  TriangleAlertIcon,
  UsersIcon,
} from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import type { CottiPlatformAnalyticsOverview } from '@/types/cotti/platformAnalytics';

import { formatCost, formatUsd } from './format';
import MetricCard from './MetricCard';
import { styles } from './style';

interface OverviewProps {
  data?: CottiPlatformAnalyticsOverview;
  loading?: boolean;
}

const formatPercent = (value: number) => `${formatNumber(value * 100, 2)}%`;

const Overview = memo<OverviewProps>(({ data, loading }) => {
  const { t } = useTranslation('setting');
  const overview = data ?? {
    activeTopics: 0,
    activeUsers: 0,
    assistantMessages: 0,
    averageCostPerAssistantMessage: 0,
    errorMessages: 0,
    errorRate: 0,
    newUsers: 0,
    realActiveUsers: 0,
    recordedCost: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
    totalUsers: 0,
    userMessages: 0,
  };

  return (
    <div className={styles.metricGrid}>
      <MetricCard
        fullValue={`${formatUsd(overview.recordedCost)} · ${t('platformAnalytics.compact.costBasis')}`}
        icon={CircleDollarSignIcon}
        loading={loading}
        title={t('platformAnalytics.metric.cost.title')}
        value={formatCost(overview.recordedCost)}
        description={t('platformAnalytics.compact.tokens', {
          total: formatUsageValue(overview.totalTokens),
          input: formatUsageValue(overview.totalInputTokens),
          output: formatUsageValue(overview.totalOutputTokens),
        })}
      />
      <MetricCard
        fullValue={`${t('platformAnalytics.metric.activeUsers.fullValue', { real: overview.realActiveUsers, total: overview.activeUsers })} · ${t('platformAnalytics.metric.activeUsers.desc')}`}
        icon={UsersIcon}
        loading={loading}
        title={t('platformAnalytics.compact.activeUsers')}
        value={formatUsageValue(overview.realActiveUsers)}
        description={t('platformAnalytics.compact.users', {
          total: overview.totalUsers,
          added: overview.newUsers,
        })}
      />
      <MetricCard
        fullValue={formatNumber(overview.activeTopics)}
        icon={MessageSquareTextIcon}
        loading={loading}
        title={t('platformAnalytics.auxiliary.activeTopics')}
        value={formatUsageValue(overview.activeTopics)}
        description={t('platformAnalytics.compact.messages', {
          user: formatUsageValue(overview.userMessages),
          assistant: formatUsageValue(overview.assistantMessages),
        })}
      />
      <MetricCard
        fullValue={formatPercent(overview.errorRate)}
        icon={TriangleAlertIcon}
        loading={loading}
        title={t('platformAnalytics.compact.errorRate')}
        value={formatPercent(overview.errorRate)}
        description={t('platformAnalytics.metric.errorRate.desc', {
          count: formatNumber(overview.errorMessages),
        })}
      />
    </div>
  );
});

Overview.displayName = 'Overview';
export default Overview;
