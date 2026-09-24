'use client';

import { Flexbox } from '@lobehub/ui';
import { Button, confirmModal, Select, Skeleton, Text, toast } from '@lobehub/ui/base-ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { CottiProfessionalModelId } from '@/_custom/registry/modelDisplayConfig';
import { isCottiProfessionalModel } from '@/_custom/registry/modelDisplayConfig';
import AsyncError from '@/components/AsyncError';
import { useClientDataSWR } from '@/libs/swr';
import { cottiModelDisplayService } from '@/services/cottiModelDisplay';
import type { ModelDisplayConfig } from '@/types/modelDisplay';

import { getProfessionalModelMatchOptions } from './professionalModelMatch';

const styles = createStaticStyles(({ css }) => ({
  fieldLabel: css`
    color: ${cssVar.colorTextSecondary};
  `,
  hint: css`
    color: ${cssVar.colorTextTertiary};
  `,
  select: css`
    flex: 1;
    min-width: 200px;
  `,
}));

interface ProfessionalModelMatchFieldProps {
  className?: string;
  disabled?: boolean;
  onSwitched: (config: ModelDisplayConfig) => Promise<void> | void;
}

export const ProfessionalModelMatchField = memo<ProfessionalModelMatchFieldProps>(
  ({ className, disabled, onSwitched }) => {
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
      () => getProfessionalModelMatchOptions(statusSWR.data?.options || []),
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
          variant={'inline'}
          onRetry={() => void statusSWR.mutate()}
        />
      );
    }

    const status = statusSWR.data;
    if (!status) return <Skeleton height={160} />;

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
      const targetModel = selectedModel;

      confirmModal({
        cancelText: t('cancel', { ns: 'common' }),
        content: t('platformManagement.models.professional.confirm.content', {
          count: status.affectedAgentCount,
          current: activeModel.model,
          target: targetModel,
        }),
        okText: t('platformManagement.models.professional.confirm.action'),
        onOk: () => executeSwitch(targetModel),
        title: t('platformManagement.models.professional.confirm.title'),
      });
    };

    const unavailable = options.length < 2;

    return (
      <Flexbox className={className} gap={6}>
        <Text className={styles.fieldLabel} fontSize={12}>
          {t('platformManagement.models.professional.selector')}
        </Text>
        <Flexbox horizontal gap={8}>
          <Select
            className={styles.select}
            disabled={disabled || switching}
            options={options}
            value={selectedModel}
            onChange={setSelectedModel}
          />
          <Button
            loading={switching}
            disabled={
              disabled || !selectedModel || selectedModel === activeModel.model || unavailable
            }
            onClick={confirmSwitch}
          >
            {t('platformManagement.models.professional.actions.switch')}
          </Button>
        </Flexbox>
        <Text className={styles.hint} fontSize={12}>
          {disabled
            ? t('platformManagement.models.professional.saveFirst')
            : unavailable
              ? t('platformManagement.models.professional.unavailable')
              : t('platformManagement.models.professional.impact', {
                  count: status.affectedAgentCount,
                })}
        </Text>
      </Flexbox>
    );
  },
);

ProfessionalModelMatchField.displayName = 'ProfessionalModelMatchField';
