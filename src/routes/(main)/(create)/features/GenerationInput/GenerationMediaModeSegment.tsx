'use client';

import { Text } from '@lobehub/ui/base-ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

export interface GenerationMediaModeSegmentProps {
  layout?: 'hero' | 'toolbar';
  mode: 'image' | 'video';
}

// Video entry is disabled by the enterprise policy; keep the image heading.
const GenerationMediaModeSegment = memo<GenerationMediaModeSegmentProps>(
  ({ layout = 'toolbar' }) => {
    const { t } = useTranslation('common');
    return layout === 'hero' ? (
      <Text fontSize={24} weight={600}>
        {t('tab.image')}
      </Text>
    ) : null;
  },
);

export default GenerationMediaModeSegment;
