'use client';

import { Empty } from '@lobehub/ui';
import { Button } from '@lobehub/ui/base-ui';
import { BarChart3Icon, SearchXIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { styles } from './style';

interface DetailEmptyProps {
  emptyDescription: string;
  emptyTitle: string;
  hasQuery: boolean;
  onClearQuery: () => void;
  onRefresh: () => void;
}

export const DetailEmpty = memo<DetailEmptyProps>(
  ({ emptyDescription, emptyTitle, hasQuery, onClearQuery, onRefresh }) => {
    const { t } = useTranslation('setting');

    return (
      <div className={styles.detailEmpty}>
        <Empty
          description={hasQuery ? t('platformAnalytics.details.noResults.desc') : emptyDescription}
          icon={hasQuery ? SearchXIcon : BarChart3Icon}
          title={hasQuery ? t('platformAnalytics.details.noResults.title') : emptyTitle}
        >
          <Button size={'small'} onClick={hasQuery ? onClearQuery : onRefresh}>
            {hasQuery ? t('platformAnalytics.details.clearSearch') : t('platformAnalytics.refresh')}
          </Button>
        </Empty>
      </div>
    );
  },
);

DetailEmpty.displayName = 'DetailEmpty';
