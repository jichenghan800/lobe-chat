'use client';

import { formatNumber, formatUsageValue } from '@lobechat/utils';
import { Block, Empty, Flexbox, Icon } from '@lobehub/ui';
import { Skeleton, Text, Tooltip } from '@lobehub/ui/base-ui';
import type { LucideIcon } from 'lucide-react';
import { FileUpIcon, ImageIcon, SearchIcon, VideoIcon, WrenchIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncError from '@/components/AsyncError';
import type {
  CottiPlatformAnalyticsFeatures,
  CottiPlatformAnalyticsGenerationFeature,
} from '@/types/cotti/platformAnalytics';

import { styles } from './style';

interface FeatureMetric {
  label: string;
  value: number;
}

interface FeatureCardProps {
  icon: LucideIcon;
  loading?: boolean;
  metrics: FeatureMetric[];
  primaryLabel: string;
  primaryValue: number;
  title: string;
}

const FeatureCard = memo<FeatureCardProps>(
  ({ icon, loading, metrics, primaryLabel, primaryValue, title }) => (
    <Block className={styles.featureCard} gap={16} padding={16} variant={'outlined'}>
      <Flexbox horizontal align={'center'} gap={12}>
        <span className={styles.metricIcon}>
          <Icon icon={icon} size={17} />
        </span>
        <Text fontSize={14} weight={600}>
          {title}
        </Text>
      </Flexbox>
      <Flexbox className={styles.featurePrimary} gap={6}>
        <Text fontSize={12} type={'secondary'}>
          {primaryLabel}
        </Text>
        {loading ? (
          <Skeleton style={{ height: 28, width: '62%' }} />
        ) : (
          <Tooltip title={formatNumber(primaryValue)}>
            <Text className={styles.metricValue} fontSize={26} weight={600}>
              {formatUsageValue(primaryValue)}
            </Text>
          </Tooltip>
        )}
      </Flexbox>
      <div className={styles.featureMetricGrid}>
        {metrics.map((metric) => (
          <Flexbox gap={4} key={metric.label}>
            <Text fontSize={12} type={'secondary'}>
              {metric.label}
            </Text>
            {loading ? (
              <Skeleton style={{ height: 18, width: '70%' }} />
            ) : (
              <Tooltip title={formatNumber(metric.value)}>
                <Text className={styles.metricValue} fontSize={16} weight={600}>
                  {formatUsageValue(metric.value)}
                </Text>
              </Tooltip>
            )}
          </Flexbox>
        ))}
      </div>
    </Block>
  ),
);

FeatureCard.displayName = 'CottiPlatformAnalyticsFeatureCard';

interface FeatureAdoptionProps {
  data?: CottiPlatformAnalyticsFeatures;
  error?: unknown;
  loading?: boolean;
  onRetry: () => void;
  retrying?: boolean;
}

const createEmptyGenerationFeature = (
  type: 'image' | 'video',
): CottiPlatformAnalyticsGenerationFeature => ({
  activeUsers: 0,
  errorResults: 0,
  requests: 0,
  requestsWithoutResults: 0,
  resultRows: 0,
  successfulAssets: 0,
  type,
});

const isFeatureAdoptionEmpty = (data: CottiPlatformAnalyticsFeatures) =>
  data.search.totalSearchEvents === 0 &&
  data.tools.results === 0 &&
  data.files.fileRelations === 0 &&
  data.generations.every((item) => item.requests === 0);

export const FeatureAdoption = memo<FeatureAdoptionProps>(
  ({ data, error, loading, onRetry, retrying }) => {
    const { t } = useTranslation('setting');
    const generationCards = data?.generations ?? [];
    const image =
      generationCards.find((item) => item.type === 'image') ??
      createEmptyGenerationFeature('image');
    const video =
      generationCards.find((item) => item.type === 'video') ??
      createEmptyGenerationFeature('video');
    const generationMetrics = (item: CottiPlatformAnalyticsGenerationFeature): FeatureMetric[] => [
      { label: t('platformAnalytics.features.metric.activeUsers'), value: item.activeUsers },
      { label: t('platformAnalytics.features.generation.resultRows'), value: item.resultRows },
      {
        label: t('platformAnalytics.features.generation.successfulAssets'),
        value: item.successfulAssets,
      },
      { label: t('platformAnalytics.features.generation.errorResults'), value: item.errorResults },
      {
        label: t('platformAnalytics.features.generation.requestsWithoutResults'),
        value: item.requestsWithoutResults,
      },
    ];

    const cards = [
      {
        icon: SearchIcon,
        metrics: [
          {
            label: t('platformAnalytics.features.metric.activeUsers'),
            value: data?.search.activeUsers ?? 0,
          },
          {
            label: t('platformAnalytics.features.search.builtin'),
            value: data?.search.builtinSearchMessages ?? 0,
          },
          {
            label: t('platformAnalytics.features.search.web'),
            value: data?.search.webSearchToolResults ?? 0,
          },
        ],
        primaryLabel: t('platformAnalytics.features.search.primary'),
        primaryValue: data?.search.totalSearchEvents ?? 0,
        title: t('platformAnalytics.features.search.title'),
      },
      {
        icon: WrenchIcon,
        metrics: [
          {
            label: t('platformAnalytics.features.metric.activeUsers'),
            value: data?.tools.activeUsers ?? 0,
          },
          {
            label: t('platformAnalytics.features.tools.errorResults'),
            value: data?.tools.errorResults ?? 0,
          },
          {
            label: t('platformAnalytics.features.tools.rejectedOrAborted'),
            value: data?.tools.rejectedOrAbortedResults ?? 0,
          },
        ],
        primaryLabel: t('platformAnalytics.features.tools.primary'),
        primaryValue: data?.tools.results ?? 0,
        title: t('platformAnalytics.features.tools.title'),
      },
      {
        icon: FileUpIcon,
        metrics: [
          {
            label: t('platformAnalytics.features.metric.activeUsers'),
            value: data?.files.activeUsers ?? 0,
          },
          {
            label: t('platformAnalytics.features.files.messagesWithFiles'),
            value: data?.files.messagesWithFiles ?? 0,
          },
          {
            label: t('platformAnalytics.features.files.distinctFiles'),
            value: data?.files.distinctFiles ?? 0,
          },
        ],
        primaryLabel: t('platformAnalytics.features.files.primary'),
        primaryValue: data?.files.fileRelations ?? 0,
        title: t('platformAnalytics.features.files.title'),
      },
      {
        icon: ImageIcon,
        metrics: generationMetrics(image),
        primaryLabel: t('platformAnalytics.features.generation.primary'),
        primaryValue: image.requests,
        title: t('platformAnalytics.features.image.title'),
      },
      {
        icon: VideoIcon,
        metrics: generationMetrics(video),
        primaryLabel: t('platformAnalytics.features.generation.primary'),
        primaryValue: video.requests,
        title: t('platformAnalytics.features.video.title'),
      },
    ];

    return (
      <Block className={styles.section} gap={16} padding={20} variant={'outlined'}>
        <Flexbox gap={4}>
          <Text fontSize={18} weight={600}>
            {t('platformAnalytics.features.title')}
          </Text>
          <Text fontSize={13} type={'secondary'}>
            {t('platformAnalytics.features.desc')}
          </Text>
        </Flexbox>
        {error && !data ? (
          <AsyncError error={error} retrying={retrying} variant={'block'} onRetry={onRetry} />
        ) : (
          <>
            {error && (
              <AsyncError error={error} retrying={retrying} variant={'inline'} onRetry={onRetry} />
            )}
            {data && isFeatureAdoptionEmpty(data) ? (
              <Empty
                description={t('platformAnalytics.features.empty.desc')}
                icon={SearchIcon}
                title={t('platformAnalytics.features.empty.title')}
              />
            ) : (
              <div className={styles.featureGrid}>
                {cards.map((card) => (
                  <FeatureCard {...card} key={card.title} loading={loading} />
                ))}
              </div>
            )}
          </>
        )}
      </Block>
    );
  },
);

FeatureAdoption.displayName = 'FeatureAdoption';
