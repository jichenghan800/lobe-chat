'use client';

import { Tag } from '@lobehub/ui/base-ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import type { CottiTopicOverviewMode } from '@/types/cotti/topicOverview';

interface TopicModeTagProps {
  mode: CottiTopicOverviewMode;
}

export const TopicModeTag = memo<TopicModeTagProps>(({ mode }) => {
  const { t } = useTranslation('topic');

  return (
    <Tag size={'small'} style={{ flex: 'none' }}>
      {t(`overview.mode.${mode}`)}
    </Tag>
  );
});

TopicModeTag.displayName = 'CottiTopicOverviewModeTag';
