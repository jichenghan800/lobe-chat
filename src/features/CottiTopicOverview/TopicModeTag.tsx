'use client';

import { Tag } from '@lobehub/ui/base-ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import type { CottiTopicOverviewMode } from '@/types/cotti/topicOverview';

interface TopicModeTagProps {
  inferred?: boolean;
  mode: CottiTopicOverviewMode;
}

export const TopicModeTag = memo<TopicModeTagProps>(({ mode, inferred }) => {
  const { t } = useTranslation('topic');

  return (
    <Tag
      size={'small'}
      style={{ flex: 'none' }}
      title={t(inferred ? 'overview.modeInferred' : 'overview.modeRecorded')}
    >
      {t(`overview.mode.${mode}`)}
      {inferred && mode !== 'unknown' ? ' *' : ''}
    </Tag>
  );
});

TopicModeTag.displayName = 'CottiTopicOverviewModeTag';
