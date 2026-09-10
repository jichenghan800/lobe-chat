'use client';

import { Center, Empty } from '@lobehub/ui';
import { GalleryVerticalEndIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

export const EmptyDetail = memo(() => {
  const { t } = useTranslation('topic');

  return (
    <Center height={'100%'} padding={24}>
      <Empty
        description={t('overview.selectDescription')}
        icon={GalleryVerticalEndIcon}
        title={t('overview.selectTitle')}
      />
    </Center>
  );
});

EmptyDetail.displayName = 'CottiTopicOverviewEmptyDetail';
