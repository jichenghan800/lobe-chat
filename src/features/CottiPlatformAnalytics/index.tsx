'use client';

import { Empty, Flexbox, Icon } from '@lobehub/ui';
import { Button, Text } from '@lobehub/ui/base-ui';
import { BarChart3Icon, RefreshCwIcon } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncError from '@/components/AsyncError';
import NavHeader from '@/features/NavHeader';
import SettingContainer from '@/features/Setting/SettingContainer';

import { ErrorDistribution } from './ErrorDistribution';
import { FeatureAdoption } from './FeatureAdoption';
import {
  useCottiPlatformAdminAccess,
  useCottiPlatformAnalyticsDashboard,
  useCottiPlatformAnalyticsFeatures,
  useCottiPlatformAnalyticsRange,
} from './hooks';
import Overview from './Overview';
import RangeControl from './RangeControl';
import { styles } from './style';
import type { CottiPlatformAnalyticsTrendMetric } from './trend';
import TrendSection from './TrendSection';
import { UsageDetails } from './UsageDetails';

interface CottiPlatformAnalyticsProps {
  embedded?: boolean;
}

const CottiPlatformAnalytics = memo<CottiPlatformAnalyticsProps>(({ embedded = false }) => {
  const { i18n, t } = useTranslation('setting');
  const { enabled, swr: accessSWR } = useCottiPlatformAdminAccess();
  const rangeState = useCottiPlatformAnalyticsRange();
  const canLoadDashboard = enabled && accessSWR.data?.isAdmin === true;
  const dashboardSWR = useCottiPlatformAnalyticsDashboard(rangeState.range, canLoadDashboard);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [errorsOpen, setErrorsOpen] = useState(false);
  const featuresSWR = useCottiPlatformAnalyticsFeatures(
    rangeState.range,
    canLoadDashboard && featuresOpen,
  );
  const [trendMetric, setTrendMetric] = useState<CottiPlatformAnalyticsTrendMetric>('recordedCost');

  const dashboard = dashboardSWR.data;
  const initialError = (!accessSWR.data && accessSWR.error) || (!dashboard && dashboardSWR.error);
  const isLoading = accessSWR.isLoading || (canLoadDashboard && dashboardSWR.isLoading);
  const generatedAt = dashboard
    ? new Intl.DateTimeFormat(i18n.language, {
        dateStyle: 'medium',
        timeStyle: 'medium',
        timeZone: dashboard.period.timezone,
      }).format(new Date(dashboard.generatedAt))
    : undefined;

  const retryInitialLoad = () => {
    if (accessSWR.error) void accessSWR.mutate();
    else void dashboardSWR.mutate();
  };

  const content = !enabled ? (
    <Empty
      description={t('platformAnalytics.disabled.desc')}
      icon={BarChart3Icon}
      title={t('platformAnalytics.disabled.title')}
    />
  ) : initialError ? (
    <AsyncError error={initialError} variant={'page'} onRetry={retryInitialLoad} />
  ) : (
    <Flexbox gap={12}>
      <div className={styles.pageHeader}>
        <RangeControl
          mode={rangeState.mode}
          range={rangeState.range}
          setCustomDate={rangeState.setCustomDate}
          setMode={rangeState.setMode}
        />
        <Flexbox horizontal align={'center'} gap={12} wrap={'wrap'}>
          <Text className={styles.generatedAt} fontSize={12}>
            {generatedAt
              ? t('platformAnalytics.generatedAt', { time: generatedAt })
              : t('platformAnalytics.loading')}
          </Text>
          <Button
            disabled={!canLoadDashboard}
            icon={<Icon icon={RefreshCwIcon} />}
            loading={dashboardSWR.isValidating || featuresSWR.isValidating}
            size={'small'}
            onClick={() => {
              void Promise.all([
                dashboardSWR.mutate(),
                ...(featuresOpen ? [featuresSWR.mutate()] : []),
              ]);
            }}
          >
            {t('platformAnalytics.refresh')}
          </Button>
        </Flexbox>
      </div>
      {dashboard && dashboardSWR.error && (
        <AsyncError
          error={dashboardSWR.error}
          variant={'inline'}
          onRetry={() => void dashboardSWR.mutate()}
        />
      )}
      {!accessSWR.data || isLoading ? (
        <>
          <Overview loading />
          <TrendSection loading metric={trendMetric} setMetric={setTrendMetric} />
        </>
      ) : (
        <>
          <Overview data={dashboard?.overview} />
          <TrendSection data={dashboard?.trends} metric={trendMetric} setMetric={setTrendMetric} />
        </>
      )}
      {canLoadDashboard && (
        <>
          <UsageDetails enabled={canLoadDashboard} range={rangeState.range} />
          <details
            className={styles.disclosure}
            open={errorsOpen}
            onToggle={(e) => setErrorsOpen(e.currentTarget.open)}
          >
            <summary>{t('platformAnalytics.errors.title')}</summary>
            {errorsOpen && (
              <ErrorDistribution enabled={canLoadDashboard} range={rangeState.range} />
            )}
          </details>
          <details
            className={styles.disclosure}
            open={featuresOpen}
            onToggle={(e) => setFeaturesOpen(e.currentTarget.open)}
          >
            <summary>{t('platformAnalytics.features.title')}</summary>
            {featuresOpen && (
              <FeatureAdoption
                data={featuresSWR.data}
                error={featuresSWR.error}
                loading={!featuresSWR.data && !featuresSWR.error}
                retrying={featuresSWR.isValidating}
                onRetry={() => void featuresSWR.mutate()}
              />
            )}
          </details>
        </>
      )}
    </Flexbox>
  );

  if (embedded) return content;

  return (
    <Flexbox height={'100%'} width={'100%'}>
      <NavHeader>
        <Text weight={500}>{t('platformAnalytics.title')}</Text>
      </NavHeader>
      <SettingContainer
        className={styles.content}
        maxWidth={1280}
        paddingBlock={24}
        paddingInline={24}
        variant={'secondary'}
      >
        {content}
      </SettingContainer>
    </Flexbox>
  );
});

CottiPlatformAnalytics.displayName = 'CottiPlatformAnalytics';

export default CottiPlatformAnalytics;
