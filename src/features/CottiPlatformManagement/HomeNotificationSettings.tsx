'use client';

import { Block, Flexbox, Icon, TextArea } from '@lobehub/ui';
import { Button, Skeleton, Switch, Text, toast } from '@lobehub/ui/base-ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { BellRingIcon, RotateCcwIcon, SaveIcon } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useCottiHomeNotification } from '@/_custom/hooks/useCottiHomeNotification';
import AsyncError from '@/components/AsyncError';
import { cottiHomeNotificationService } from '@/services/cottiHomeNotification';

import { sharedStyles } from './sharedStyle';

const DEFAULT_CONTENT = '已进入待命状态\n带着新问题来了吧';

const styles = createStaticStyles(({ css }) => ({
  preview: css`
    min-height: 72px;
    padding-block: 12px;
    padding-inline: 14px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};

    font-size: 14px;
    line-height: 1.6;
    white-space: pre-wrap;

    background: ${cssVar.colorFillQuaternary};
  `,
  statusRow: css`
    padding-block: 12px;
    padding-inline: 14px;
    border-radius: ${cssVar.borderRadiusLG};
    background: ${cssVar.colorFillQuaternary};
  `,
}));

const HomeNotificationSettings = memo(() => {
  const { t } = useTranslation('setting');
  const configSWR = useCottiHomeNotification();
  const [enabled, setEnabled] = useState(false);
  const [content, setContent] = useState(DEFAULT_CONTENT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!configSWR.data) return;

    setEnabled(configSWR.data.enabled);
    setContent(configSWR.data.content || DEFAULT_CONTENT);
  }, [configSWR.data]);

  if (configSWR.error) {
    return (
      <AsyncError
        error={configSWR.error}
        variant={'block'}
        onRetry={() => void configSWR.mutate()}
      />
    );
  }

  if (!configSWR.data) return <Skeleton height={240} />;

  const normalizedContent = content.trim() || DEFAULT_CONTENT;
  const dirty =
    enabled !== configSWR.data.enabled || normalizedContent !== configSWR.data.content.trim();
  const save = async () => {
    if (enabled && !content.trim()) {
      toast.warning(t('platformManagement.homeNotification.feedback.contentRequired'));
      return;
    }

    setSaving(true);
    try {
      const saved = await cottiHomeNotificationService.updateConfig({
        content: normalizedContent,
        enabled,
      });
      await configSWR.mutate(saved, { revalidate: false });
      toast.success(t('platformManagement.homeNotification.feedback.saved'));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('platformManagement.homeNotification.feedback.saveFailed'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Flexbox gap={16}>
      <Block className={sharedStyles.card} gap={16} padding={20} variant={'outlined'}>
        <Flexbox className={sharedStyles.sectionHeader} gap={4}>
          <Text className={sharedStyles.sectionTitle}>
            {t('platformManagement.homeNotification.title')}
          </Text>
          <Text className={sharedStyles.copy} fontSize={13}>
            {t('platformManagement.homeNotification.desc')}
          </Text>
        </Flexbox>
        <Flexbox horizontal align={'center'} className={styles.statusRow} gap={12}>
          <Icon icon={BellRingIcon} />
          <Flexbox flex={1} gap={2}>
            <Text weight={600}>
              {enabled
                ? t('platformManagement.homeNotification.status.enabled')
                : t('platformManagement.homeNotification.status.disabled')}
            </Text>
            <Text className={sharedStyles.copy} fontSize={13}>
              {enabled
                ? t('platformManagement.homeNotification.status.enabledDesc')
                : t('platformManagement.homeNotification.status.disabledDesc')}
            </Text>
          </Flexbox>
          <Switch checked={enabled} disabled={saving} onChange={setEnabled} />
        </Flexbox>
        <Flexbox gap={8}>
          <Text weight={500}>{t('platformManagement.homeNotification.content.label')}</Text>
          <TextArea
            showCount
            maxLength={500}
            rows={4}
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
        </Flexbox>
        <Flexbox gap={8}>
          <Text className={sharedStyles.copy} fontSize={13}>
            {t('platformManagement.homeNotification.preview')}
          </Text>
          <div className={styles.preview}>{normalizedContent}</div>
        </Flexbox>
      </Block>
      <div className={sharedStyles.actionRow}>
        <Text className={sharedStyles.copy} fontSize={12}>
          {dirty
            ? t('platformManagement.homeNotification.saveState.unsaved')
            : t('platformManagement.homeNotification.saveState.saved')}
        </Text>
        <Button
          disabled={saving}
          icon={<Icon icon={RotateCcwIcon} />}
          onClick={() => setContent(DEFAULT_CONTENT)}
        >
          {t('platformManagement.homeNotification.actions.restore')}
        </Button>
        <Button
          disabled={!dirty}
          icon={<Icon icon={SaveIcon} />}
          loading={saving}
          type={'primary'}
          onClick={() => void save()}
        >
          {t('platformManagement.homeNotification.actions.save')}
        </Button>
      </div>
    </Flexbox>
  );
});

HomeNotificationSettings.displayName = 'HomeNotificationSettings';

export default HomeNotificationSettings;
