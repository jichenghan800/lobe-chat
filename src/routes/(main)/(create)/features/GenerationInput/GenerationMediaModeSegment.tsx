'use client';

import { Flexbox, Icon } from '@lobehub/ui';
import type { SelectProps } from '@lobehub/ui/base-ui';
import { Select } from '@lobehub/ui/base-ui';
import { createStaticStyles } from 'antd-style';
import { ImageIcon, Video } from 'lucide-react';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { isVideoGenerationHidden } from '@/_custom/registry/generationVisibility';
import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';

export interface GenerationMediaModeSegmentProps {
  /** `hero`: large inline headline select (cyan, borderless). `toolbar`: compact control in the input bar. */
  layout?: 'hero' | 'toolbar';
  mode: 'image' | 'video';
}

const styles = createStaticStyles(({ css, cssVar }) => ({
  lite: css`
    height: 36px;
  `,
  heroSelect: css`
    width: auto;
    font-size: inherit;
    line-height: 1.2;
  `,
  heroText: css`
    font-size: 24px;
    font-weight: 600;
    line-height: 1.2;
  `,
  staticLabel: css`
    height: 36px;
    color: ${cssVar.colorText};
  `,
}));

const GenerationMediaModeSegment = memo<GenerationMediaModeSegmentProps>(
  ({ mode, layout = 'toolbar' }) => {
    const { t } = useTranslation('common');
    const navigate = useWorkspaceAwareNavigate();
    const isHero = layout === 'hero';
    const hideVideo = isVideoGenerationHidden();
    const imageLabel = t('tab.image');

    const options = useMemo<SelectProps['options']>(() => {
      const items: NonNullable<SelectProps['options']> = [
        {
          label: (
            <Flexbox horizontal align="center" gap={8}>
              {!isHero && <Icon icon={ImageIcon} />}
              <span className={isHero ? styles.heroText : undefined}>{t('tab.image')}</span>
            </Flexbox>
          ),
          value: 'image',
        },
      ];

      if (!hideVideo) {
        items.push({
          label: (
            <Flexbox horizontal align="center" gap={8}>
              {!isHero && <Icon icon={Video} />}
              <span className={isHero ? styles.heroText : undefined}>{t('tab.video')}</span>
            </Flexbox>
          ),
          value: 'video',
        });
      }

      return items;
    }, [t, isHero, hideVideo]);

    const labelRender: SelectProps['labelRender'] = useCallback(
      (props) => {
        const v = String((props as { value?: string }).value ?? '');
        const isVideo = v === 'video';
        const text = isVideo ? t('tab.video') : t('tab.image');
        if (isHero) {
          return (
            <span
              style={{
                fontSize: 'inherit',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              {text}
            </span>
          );
        }
        return (
          <Flexbox horizontal align="center" gap={6}>
            <Icon icon={isVideo ? Video : ImageIcon} size={16} />
            <span style={{ whiteSpace: 'nowrap' }}>{text}</span>
          </Flexbox>
        );
      },
      [isHero, t],
    );

    const handleChange = useCallback(
      (value: string) => {
        if (value === mode) return;
        if (value === 'video' && hideVideo) return;
        navigate(value === 'video' ? '/video' : '/image');
      },
      [mode, hideVideo, navigate],
    );

    if (hideVideo && mode === 'image') {
      if (isHero) {
        return (
          <span className={styles.heroText} style={{ whiteSpace: 'nowrap' }}>
            {imageLabel}
          </span>
        );
      }

      return (
        <Flexbox horizontal align="center" className={styles.staticLabel} gap={6}>
          <Icon icon={ImageIcon} size={16} />
          <span style={{ whiteSpace: 'nowrap' }}>{imageLabel}</span>
        </Flexbox>
      );
    }

    return (
      <Select
        className={isHero ? styles.heroSelect : styles.lite}
        labelRender={labelRender}
        options={options}
        popupMatchSelectWidth={false}
        size={isHero ? 'large' : 'middle'}
        value={mode}
        variant={isHero ? 'borderless' : 'filled'}
        onChange={handleChange}
      />
    );
  },
);

GenerationMediaModeSegment.displayName = 'GenerationMediaModeSegment';

export default GenerationMediaModeSegment;
