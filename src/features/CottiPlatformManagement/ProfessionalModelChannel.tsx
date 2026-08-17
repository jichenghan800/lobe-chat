'use client';

import { Block, Flexbox, Skeleton, Tag, Text } from '@lobehub/ui';
import { Button, confirmModal, Select, toast } from '@lobehub/ui/base-ui';
import { createStaticStyles, cssVar, responsive } from 'antd-style';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type CottiProfessionalModelId,
  isCottiProfessionalModel,
} from '@/_custom/registry/modelDisplayConfig';
import AsyncError from '@/components/AsyncError';
import { useClientDataSWR } from '@/libs/swr';
import { cottiModelDisplayService } from '@/services/cottiModelDisplay';
import type { ModelDisplayConfig } from '@/types/modelDisplay';

import { sharedStyles } from './sharedStyle';

const styles = createStaticStyles(({ css }) => ({
  channelRow: css`
    display: grid;
    grid-template-columns: minmax(240px, 1fr) auto;
    gap: 16px;
    align-items: end;

    ${responsive.md} {
      grid-template-columns: 1fr;
    }
  `,
  modelSelect: css`
    width: 100%;
  `,
  status: css`
    padding-block: 10px;
    padding-inline: 12px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};

    background: ${cssVar.colorFillQuaternary};
  `,
}));

interface ProfessionalModelChannelProps {
  disabled?: boolean;
  onSwitched: (config: ModelDisplayConfig) => Promise<void> | void;
}

const ProfessionalModelChannel = memo<ProfessionalModelChannelProps>(({ disabled, onSwitched }) => {
  const { t } = useTranslation('setting');
  const [selectedModel, setSelectedModel] = useState<CottiProfessionalModelId>();
  const [switching, setSwitching] = useState(false);
  const statusSWR = useClientDataSWR(
    ['cotti', 'professional-model'],
    () => cottiModelDisplayService.getProfessionalModelStatus(),
    { revalidateOnFocus: false },
  );
  const currentModel = statusSWR.data?.currentModel;
  const options = useMemo(
    () =>
      (statusSWR.data?.options || [])
        .filter(isCottiProfessionalModel)
        .map(({ label, model }) => ({ label, value: model })),
    [statusSWR.data?.options],
  );

  useEffect(() => {
    if (currentModel && isCottiProfessionalModel(currentModel)) {
      setSelectedModel(currentModel.model);
    }
  }, [currentModel]);

  if (statusSWR.error) {
    return (
      <AsyncError
        error={statusSWR.error}
        variant={'block'}
        onRetry={() => void statusSWR.mutate()}
      />
    );
  }

  const status = statusSWR.data;
  if (!status) {
    return <Skeleton active paragraph={{ rows: 3 }} title={false} />;
  }
  const activeModel = status.currentModel;

  const executeSwitch = async (targetModel: CottiProfessionalModelId) => {
    setSwitching(true);
    try {
      const result = await cottiModelDisplayService.switchProfessionalModel(targetModel);
      await onSwitched(result.config);
      await statusSWR.mutate(
        { ...status, currentModel: result.targetModel },
        { revalidate: false },
      );
      toast.success(
        t('platformManagement.models.professional.feedback.switched', {
          model: result.targetModel.model,
        }),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('platformManagement.models.professional.feedback.switchFailed'),
      );
    } finally {
      setSwitching(false);
    }
  };

  const confirmSwitch = () => {
    if (!selectedModel || selectedModel === activeModel.model) return;

    confirmModal({
      cancelText: t('cancel', { ns: 'common' }),
      content: t('platformManagement.models.professional.confirm.content', {
        count: status.affectedAgentCount,
        current: activeModel.model,
        target: selectedModel,
      }),
      okText: t('platformManagement.models.professional.confirm.action'),
      onOk: () => {
        void executeSwitch(selectedModel);
      },
      title: t('platformManagement.models.professional.confirm.title'),
    });
  };

  return (
    <Block className={sharedStyles.card} gap={16} padding={20} variant={'outlined'}>
      <Flexbox className={sharedStyles.sectionHeader} gap={4}>
        <Flexbox horizontal align={'center'} gap={8}>
          <Text className={sharedStyles.sectionTitle}>
            {t('platformManagement.models.professional.title')}
          </Text>
          <Tag color={'processing'}>
            {t('platformManagement.models.professional.current', {
              model: activeModel.model,
            })}
          </Tag>
        </Flexbox>
        <Text className={sharedStyles.copy} fontSize={13}>
          {t('platformManagement.models.professional.desc')}
        </Text>
      </Flexbox>

      <div className={styles.status}>
        <Text className={sharedStyles.copy} fontSize={13}>
          {t('platformManagement.models.professional.impact', {
            count: status.affectedAgentCount,
          })}
        </Text>
      </div>

      <div className={styles.channelRow}>
        <Flexbox gap={6}>
          <Text fontSize={13} weight={600}>
            {t('platformManagement.models.professional.selector')}
          </Text>
          <Select
            className={styles.modelSelect}
            disabled={disabled || switching}
            options={options}
            value={selectedModel}
            onChange={setSelectedModel}
          />
        </Flexbox>
        <Button
          loading={switching}
          type={'primary'}
          disabled={
            disabled || !selectedModel || selectedModel === activeModel.model || options.length < 2
          }
          onClick={confirmSwitch}
        >
          {t('platformManagement.models.professional.actions.switch')}
        </Button>
      </div>

      {disabled && (
        <Text className={sharedStyles.copy} fontSize={12}>
          {t('platformManagement.models.professional.saveFirst')}
        </Text>
      )}
      {options.length < 2 && (
        <Text className={sharedStyles.copy} fontSize={12}>
          {t('platformManagement.models.professional.unavailable')}
        </Text>
      )}
    </Block>
  );
});

ProfessionalModelChannel.displayName = 'ProfessionalModelChannel';

export default ProfessionalModelChannel;
