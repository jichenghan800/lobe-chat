'use client';

import { formatNumber, formatUsageValue } from '@lobechat/utils';
import { Block, Flexbox } from '@lobehub/ui';
import { Text, Tooltip } from '@lobehub/ui/base-ui';
import {
  BotIcon,
  CircleDollarSignIcon,
  MessageSquareTextIcon,
  TriangleAlertIcon,
  UsersIcon,
} from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import type { CottiPlatformAnalyticsOverview } from '@/types/cotti/platformAnalytics';

import MetricCard from './MetricCard';
import { styles } from './style';

interface OverviewProps {
  data?: CottiPlatformAnalyticsOverview;
  loading?: boolean;
}

const formatCost = (value: number) => `$${formatNumber(value, value > 0 && value < 0.01 ? 4 : 2)}`;
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

  const auxiliaryItems = [
    {
      label: t('platformAnalytics.auxiliary.totalUsers'),
      value: overview.totalUsers,
    },
    {
      label: t('platformAnalytics.auxiliary.newUsers'),
      value: overview.newUsers,
    },
    {
      label: t('platformAnalytics.auxiliary.activeTopics'),
      value: overview.activeTopics,
    },
    {
      label: t('platformAnalytics.auxiliary.userMessages'),
      value: overview.userMessages,
    },
  ];

  return (
    <Flexbox gap={12}>
      <div className={styles.metricGrid}>
        <MetricCard
          description={t('platformAnalytics.metric.activeUsers.desc')}
          icon={UsersIcon}
          loading={loading}
          title={t('platformAnalytics.metric.activeUsers.title')}
          value={`${formatUsageValue(overview.realActiveUsers)} / ${formatUsageValue(overview.activeUsers)}`}
          fullValue={t('platformAnalytics.metric.activeUsers.fullValue', {
            real: formatNumber(overview.realActiveUsers),
            total: formatNumber(overview.activeUsers),
          })}
        />
        <MetricCard
          description={t('platformAnalytics.metric.assistantMessages.desc')}
          fullValue={formatNumber(overview.assistantMessages)}
          icon={BotIcon}
          loading={loading}
          title={t('platformAnalytics.metric.assistantMessages.title')}
          value={formatUsageValue(overview.assistantMessages)}
        />
        <MetricCard
          fullValue={formatNumber(overview.totalTokens)}
          icon={MessageSquareTextIcon}
          loading={loading}
          title={t('platformAnalytics.metric.tokens.title')}
          value={formatUsageValue(overview.totalTokens)}
          description={t('platformAnalytics.metric.tokens.desc', {
            input: formatUsageValue(overview.totalInputTokens),
            output: formatUsageValue(overview.totalOutputTokens),
          })}
        />
        <MetricCard
          fullValue={formatCost(overview.recordedCost)}
          icon={CircleDollarSignIcon}
          loading={loading}
          title={t('platformAnalytics.metric.cost.title')}
          value={formatCost(overview.recordedCost)}
          description={t('platformAnalytics.metric.cost.desc', {
            average: formatCost(overview.averageCostPerAssistantMessage),
          })}
        />
        <MetricCard
          fullValue={formatPercent(overview.errorRate)}
          icon={TriangleAlertIcon}
          loading={loading}
          title={t('platformAnalytics.metric.errorRate.title')}
          value={formatPercent(overview.errorRate)}
          description={t('platformAnalytics.metric.errorRate.desc', {
            count: formatNumber(overview.errorMessages),
          })}
        />
      </div>
      <Block className={styles.section} padding={16} variant={'outlined'}>
        <div className={styles.auxiliaryGrid}>
          {auxiliaryItems.map((item) => (
            <Flexbox className={styles.auxiliaryItem} gap={4} key={item.label}>
              <Text fontSize={12} type={'secondary'}>
                {item.label}
              </Text>
              <Tooltip title={formatNumber(item.value)}>
                <Text className={styles.metricValue} fontSize={18} weight={600}>
                  {loading ? '—' : formatUsageValue(item.value)}
                </Text>
              </Tooltip>
            </Flexbox>
          ))}
        </div>
      </Block>
    </Flexbox>
  );
});

Overview.displayName = 'Overview';

export default Overview;
