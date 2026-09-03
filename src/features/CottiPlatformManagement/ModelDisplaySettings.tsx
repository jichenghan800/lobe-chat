'use client';

import { Block, Empty, Flexbox, Icon, Skeleton, Tag, Text } from '@lobehub/ui';
import { Button, Select, Switch, Tabs, toast } from '@lobehub/ui/base-ui';
import { Input } from 'antd';
import { createStaticStyles, cssVar, responsive } from 'antd-style';
import isEqual from 'fast-deep-equal';
import { ArrowDownIcon, ArrowUpIcon, RotateCcwIcon, SaveIcon, SparklesIcon } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useCottiModelDisplayConfig } from '@/_custom/hooks/useCottiModelDisplayConfig';
import { isCottiProfessionalChannel } from '@/_custom/registry/modelDisplayConfig';
import AsyncError from '@/components/AsyncError';
import { useClientDataSWR } from '@/libs/swr';
import { cottiModelDisplayService } from '@/services/cottiModelDisplay';
import type {
  ModelDisplayConfig,
  ModelDisplayOption,
  ModelDisplayScope,
} from '@/types/modelDisplay';

import {
  addModelDisplayItem,
  getModelDisplayKey,
  isModelDisplayDefault,
  moveModelDisplayItem,
  setModelDisplayDefault,
  setModelDisplayItemEnabled,
  setModelDisplayName,
} from './modelDisplayDraft';
import {
  MODEL_DISPLAY_EDITOR_COLUMN_MIN_WIDTH,
  MODEL_DISPLAY_IDENTITY_COLUMN_MAX_WIDTH,
  MODEL_DISPLAY_IDENTITY_COLUMN_MIN_WIDTH,
} from './modelDisplayLayout';
import { ProfessionalModelMatchField } from './ProfessionalModelMatchField';
import { sharedStyles } from './sharedStyle';

const styles = createStaticStyles(({ css }) => ({
  addSelect: css`
    flex: 1;
    min-width: 260px;
  `,
  modelIdentity: css`
    min-width: 0;
  `,
  modelList: css`
    display: flex;
    flex-direction: column;
    gap: 10px;
  `,
  modelRow: css`
    display: grid;
    grid-template-columns:
      minmax(
        ${MODEL_DISPLAY_IDENTITY_COLUMN_MIN_WIDTH}px,
        ${MODEL_DISPLAY_IDENTITY_COLUMN_MAX_WIDTH}px
      )
      minmax(${MODEL_DISPLAY_EDITOR_COLUMN_MIN_WIDTH}px, 1fr) auto auto;
    gap: 12px;
    align-items: center;

    padding-block: 12px;
    padding-inline: 14px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};

    background: ${cssVar.colorFillQuaternary};

    ${responsive.md} {
      grid-template-columns: minmax(0, 1fr) auto;
    }
  `,
  rowActions: css`
    display: flex;
    gap: 4px;
    align-items: center;

    ${responsive.md} {
      grid-column: 1 / -1;
      justify-content: flex-end;
    }
  `,
  displayName: css`
    ${responsive.md} {
      grid-column: 1 / -1;
    }
  `,
  fieldLabel: css`
    color: ${cssVar.colorTextSecondary};
  `,
}));

const ModelDisplaySettings = memo(() => {
  const { t } = useTranslation('setting');
  const [scope, setScope] = useState<ModelDisplayScope>('chat');
  const [draft, setDraft] = useState<ModelDisplayConfig>();
  const [selectedOptionKey, setSelectedOptionKey] = useState<string>();
  const [saving, setSaving] = useState(false);
  const configSWR = useCottiModelDisplayConfig();
  const optionsSWR = useClientDataSWR(
    ['cotti', 'model-display-options'],
    () => cottiModelDisplayService.getOptions(),
    { revalidateOnFocus: false },
  );
  const dirty = Boolean(draft && configSWR.data && !isEqual(draft, configSWR.data));

  useEffect(() => {
    if (configSWR.data && (!draft || !dirty)) setDraft(configSWR.data);
  }, [configSWR.data, dirty, draft]);

  const optionMap = useMemo(
    () =>
      new Map(
        (optionsSWR.data || []).map((option: ModelDisplayOption) => [
          getModelDisplayKey(option),
          option,
        ]),
      ),
    [optionsSWR.data],
  );
  const configuredKeys = useMemo(
    () => new Set((draft?.[scope] || []).map(getModelDisplayKey)),
    [draft, scope],
  );
  const availableOptions = useMemo(
    () =>
      [...optionMap.entries()]
        .filter(([key]) => !configuredKeys.has(key))
        .map(([value, option]) => ({ label: option.label, value })),
    [configuredKeys, optionMap],
  );

  if (configSWR.error) {
    return (
      <AsyncError
        error={configSWR.error}
        variant={'block'}
        onRetry={() => void configSWR.mutate()}
      />
    );
  }

  if (!draft) return <Skeleton active paragraph={{ rows: 10 }} title={false} />;

  const updateDraft = (next: ModelDisplayConfig) => setDraft(next);
  const addSelectedModel = () => {
    if (!selectedOptionKey) return;
    const option = optionMap.get(selectedOptionKey);
    if (!option) return;

    updateDraft(addModelDisplayItem(draft, scope, option));
    setSelectedOptionKey(undefined);
  };
  const save = async () => {
    setSaving(true);
    try {
      const saved = await cottiModelDisplayService.updateConfig(draft);
      setDraft(saved);
      await configSWR.mutate(saved, { revalidate: false });
      toast.success(t('platformManagement.models.feedback.saved'));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('platformManagement.models.feedback.saveFailed'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Flexbox gap={16}>
      <Block className={sharedStyles.card} gap={16} padding={20} variant={'outlined'}>
        <Flexbox className={sharedStyles.sectionHeader} gap={4}>
          <Text className={sharedStyles.sectionTitle}>{t('platformManagement.models.title')}</Text>
          <Text className={sharedStyles.copy} fontSize={13}>
            {t('platformManagement.models.desc')}
          </Text>
        </Flexbox>
        <Tabs
          activeKey={scope}
          items={(['chat', 'agent'] as const).map((value) => ({
            key: value,
            label: t(`platformManagement.models.scope.${value}`),
          }))}
          onChange={(key) => setScope(key as ModelDisplayScope)}
        />
        {optionsSWR.error && (
          <AsyncError
            error={optionsSWR.error}
            variant={'inline'}
            onRetry={() => void optionsSWR.mutate()}
          />
        )}
        <div className={sharedStyles.toolbar}>
          <Select
            className={styles.addSelect}
            loading={optionsSWR.isLoading}
            options={availableOptions}
            placeholder={t('platformManagement.models.add.placeholder')}
            value={selectedOptionKey}
            onChange={setSelectedOptionKey}
          />
          <Button disabled={!selectedOptionKey} onClick={addSelectedModel}>
            {t('platformManagement.models.actions.add')}
          </Button>
        </div>

        {draft[scope].length === 0 ? (
          <Empty
            description={t('platformManagement.models.empty.desc')}
            icon={SparklesIcon}
            title={t('platformManagement.models.empty.title')}
          />
        ) : (
          <div className={styles.modelList}>
            {draft[scope].map((item, index) => {
              const isDefault = isModelDisplayDefault(draft, scope, item);
              const isProfessionalChannel = isCottiProfessionalChannel(item);

              return (
                <div className={styles.modelRow} key={getModelDisplayKey(item)}>
                  <Flexbox className={styles.modelIdentity} gap={4}>
                    <Flexbox horizontal align={'center'} gap={8}>
                      <Text ellipsis weight={600}>
                        {item.displayName?.trim() || item.model}
                      </Text>
                      {isDefault && (
                        <Tag color={'processing'}>
                          {t('platformManagement.models.default.badge')}
                        </Tag>
                      )}
                    </Flexbox>
                    <Text ellipsis className={sharedStyles.copy} fontSize={12}>
                      {item.provider}/{item.model}
                    </Text>
                  </Flexbox>
                  {isProfessionalChannel ? (
                    <ProfessionalModelMatchField
                      className={styles.displayName}
                      disabled={dirty || saving}
                      onSwitched={async (config) => {
                        setDraft(config);
                        await configSWR.mutate(config, { revalidate: false });
                      }}
                    />
                  ) : (
                    <Flexbox className={styles.displayName} gap={6}>
                      <Text className={styles.fieldLabel} fontSize={12}>
                        {t('platformManagement.models.displayName.label')}
                      </Text>
                      <Input
                        maxLength={100}
                        placeholder={t('platformManagement.models.displayName.placeholder')}
                        value={item.displayName}
                        onChange={(event) =>
                          updateDraft(setModelDisplayName(draft, scope, item, event.target.value))
                        }
                      />
                    </Flexbox>
                  )}
                  <Switch
                    checked={item.enabled}
                    disabled={isProfessionalChannel}
                    onChange={(enabled) => {
                      const next = setModelDisplayItemEnabled(draft, scope, item, enabled);
                      if (!next) {
                        toast.warning(t('platformManagement.models.feedback.lastModelRequired'));
                        return;
                      }
                      updateDraft(next);
                    }}
                  />
                  <div className={styles.rowActions}>
                    <Button
                      disabled={!item.enabled || isDefault}
                      size={'small'}
                      onClick={() => updateDraft(setModelDisplayDefault(draft, scope, item))}
                    >
                      {isDefault
                        ? t('platformManagement.models.default.current')
                        : t('platformManagement.models.default.action')}
                    </Button>
                    <Button
                      disabled={index === 0}
                      icon={<Icon icon={ArrowUpIcon} />}
                      size={'small'}
                      onClick={() => updateDraft(moveModelDisplayItem(draft, scope, index, -1))}
                    />
                    <Button
                      disabled={index === draft[scope].length - 1}
                      icon={<Icon icon={ArrowDownIcon} />}
                      size={'small'}
                      onClick={() => updateDraft(moveModelDisplayItem(draft, scope, index, 1))}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Block>

      <div className={sharedStyles.actionRow}>
        <Text className={sharedStyles.copy} fontSize={12}>
          {dirty
            ? t('platformManagement.models.saveState.unsaved')
            : t('platformManagement.models.saveState.saved')}
        </Text>
        <Button
          disabled={!dirty || saving}
          icon={<Icon icon={RotateCcwIcon} />}
          onClick={() => setDraft(configSWR.data)}
        >
          {t('platformManagement.models.actions.reset')}
        </Button>
        <Button
          disabled={!dirty}
          icon={<Icon icon={SaveIcon} />}
          loading={saving}
          type={'primary'}
          onClick={() => void save()}
        >
          {t('platformManagement.models.actions.save')}
        </Button>
      </div>
    </Flexbox>
  );
});

ModelDisplaySettings.displayName = 'ModelDisplaySettings';

export default ModelDisplaySettings;
