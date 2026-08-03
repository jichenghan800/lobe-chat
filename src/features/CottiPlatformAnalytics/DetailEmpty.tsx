'use client';

import { Empty } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import { BarChart3Icon, SearchXIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { styles } from './style';

interface DetailEmptyProps {
  hasQuery: boolean;
  kind: 'agents' | 'models' | 'users';
  onClearQuery: () => void;
  onRefresh: () => void;
}

export const DetailEmpty = memo<DetailEmptyProps>(({ hasQuery, kind, onClearQuery, onRefresh }) => {
  const { t } = useTranslation('setting');

  return (
    <div className={styles.detailEmpty}>
      <Empty
        icon={hasQuery ? SearchXIcon : BarChart3Icon}
        description={
          hasQuery
            ? t('platformAnalytics.details.noResults.desc')
            : t(`platformAnalytics.details.${kind}.empty.desc` as const)
        }
        title={
          hasQuery
            ? t('platformAnalytics.details.noResults.title')
            : t(`platformAnalytics.details.${kind}.empty.title` as const)
        }
      >
        <Button size={'small'} onClick={hasQuery ? onClearQuery : onRefresh}>
          {hasQuery ? t('platformAnalytics.details.clearSearch') : t('platformAnalytics.refresh')}
        </Button>
      </Empty>
    </div>
  );
});

DetailEmpty.displayName = 'DetailEmpty';
