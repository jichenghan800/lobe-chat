'use client';

import { Center, Empty, Flexbox } from '@lobehub/ui';
import { GalleryVerticalEndIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useParams } from 'react-router';

import { isCottiPlatformManagementEnabled } from '@/_custom/registry/platformManagement';
import AsyncError from '@/components/AsyncError';
import NeuralNetworkLoading from '@/components/NeuralNetworkLoading';
import { useCottiPlatformAdminAccess } from '@/features/CottiPlatformAnalytics/hooks';

import { styles } from './style';
import { TopicListPanel } from './TopicListPanel';

export const CottiTopicOverviewLayout = memo(() => {
  const { t } = useTranslation('topic');
  const { topicId } = useParams<{ topicId: string }>();
  const enabled = isCottiPlatformManagementEnabled();
  const { swr } = useCottiPlatformAdminAccess();

  if (!enabled) {
    return (
      <Center height={'100%'} padding={24}>
        <Empty
          description={t('overview.disabledDescription')}
          icon={GalleryVerticalEndIcon}
          title={t('overview.disabledTitle')}
        />
      </Center>
    );
  }

  if (swr.error && !swr.data) {
    return <AsyncError error={swr.error} variant={'page'} onRetry={() => void swr.mutate()} />;
  }

  if (!swr.data) {
    return (
      <Center height={'100%'}>
        <NeuralNetworkLoading size={24} />
      </Center>
    );
  }

  return (
    <Flexbox horizontal className={styles.layout} data-has-detail={Boolean(topicId)}>
      <TopicListPanel />
      <Flexbox className={`overview-detail-panel ${styles.detail}`} flex={1}>
        <Outlet />
      </Flexbox>
    </Flexbox>
  );
});

CottiTopicOverviewLayout.displayName = 'CottiTopicOverviewLayout';
