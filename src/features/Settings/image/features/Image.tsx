'use client';

import { Form } from '@lobehub/ui';
import { Text } from '@lobehub/ui/base-ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { COTTI_FIXED_IMAGE_GENERATION_COUNT } from '@/const/cottiGeneration';
import { FORM_STYLE } from '@/const/layoutTokens';
import { SettingsSearchAnchor } from '@/features/SettingsSearch/anchor';

const ImageSettings = memo(() => {
  const { t } = useTranslation('setting');
  return (
    <Form
      collapsible={false}
      itemsType={'group'}
      variant={'filled'}
      items={[
        {
          title: (
            <SettingsSearchAnchor id={'service-model-image'}>
              {t('settingImage.defaultCount.title')}
            </SettingsSearchAnchor>
          ),
          children: [
            {
              label: t('settingImage.defaultCount.label'),
              children: <Text>{COTTI_FIXED_IMAGE_GENERATION_COUNT}</Text>,
            },
          ],
        },
      ]}
      {...FORM_STYLE}
    />
  );
});

export default ImageSettings;
