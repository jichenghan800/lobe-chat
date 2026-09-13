'use client';

import { Block, Empty, Flexbox, Icon } from '@lobehub/ui';
import { Button, Select, Skeleton, Switch, Tabs, Tag, Text, toast } from '@lobehub/ui/base-ui';
import { Input } from 'antd';
import { createStaticStyles, cssVar, responsive } from 'antd-style';
import { ArrowDownIcon, ArrowUpIcon, SparklesIcon } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useCottiModelDisplayConfig } from '@/_custom/hooks/useCottiModelDisplayConfig';
import { isCottiProfessionalChannel } from '@/_custom/registry/modelDisplayConfig';
import { isVipModel, setModelVip } from '@/_custom/registry/userModelAccess';
import AsyncError from '@/components/AsyncError';
import { useClientDataSWR } from '@/libs/swr';
import { cottiModelDisplayService } from '@/services/cottiModelDisplay';
import { useAiInfraStore } from '@/store/aiInfra';
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
import TaskModelMigration from './TaskModelMigration';
import { useConfigAutosave } from './useConfigAutosave';

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
  const [selectedOptionKey, setSelectedOptionKey] = useState<string>();
  const [retirementSource, setRetirementSource] = useState<string>();
  const configSWR = useCottiModelDisplayConfig(true, true);
  const optionsSWR = useClientDataSWR(
    ['cotti', 'model-display-options'],
    () => cottiModelDisplayService.getOptions(),
    { revalidateOnFocus: false },
  );
  const { draft, saving, status, error, retry, save } = useConfigAutosave(
    configSWR.data,
    async (next) => {
      const saved = await cottiModelDisplayService.updateConfig(next);
      await configSWR.mutate(saved, { revalidate: false });
      // A runtime refresh failure must not roll back an already committed configuration.
      try {
        await useAiInfraStore.getState().refreshAiProviderRuntimeState();
      } catch {
        toast.warning(t('platformManagement.models.autoSave.refreshFailed'));
      }
      return saved;
    },
  );

  useEffect(() => {
    if (status === 'failed') toast.error(t('platformManagement.models.autoSave.failed'));
  }, [status, t]);

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

  if (!draft) return <Skeleton height={160} />;

  const updateDraft = (next: ModelDisplayConfig) => void save(next);
  const addSelectedModel = () => {
    if (!selectedOptionKey) return;
    const option = optionMap.get(selectedOptionKey);
    if (!option) return;

    updateDraft(addModelDisplayItem(draft, scope, option));
    setSelectedOptionKey(undefined);
  };

  return (
    <Flexbox gap={16}>
      <Block className={sharedStyles.card} gap={16} padding={20} variant={'outlined'}>
        <Flexbox className={sharedStyles.sectionHeader} gap={4}>
          <Text className={sharedStyles.sectionTitle}>{t('platformManagement.models.title')}</Text>
          <Text aria-live={'polite'} fontSize={12}>
            {t(`platformManagement.models.autoSave.${status}`)}
          </Text>
          {status === 'failed' && (
            <AsyncError error={error} variant={'inline'} onRetry={() => void retry()} />
          )}
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
          <Button disabled={saving || !selectedOptionKey} onClick={addSelectedModel}>
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
                      <Text ellipsis style={{ fontWeight: 600 }}>
                        {item.displayName?.trim() || item.model}
                      </Text>
                      {isDefault && (
                        <Tag color={'info'}>{t('platformManagement.models.default.badge')}</Tag>
                      )}
                    </Flexbox>
                    <Text ellipsis className={sharedStyles.copy} fontSize={12}>
                      {item.provider}/{item.model}
                    </Text>
                  </Flexbox>
                  {isProfessionalChannel ? (
                    <ProfessionalModelMatchField
                      className={styles.displayName}
                      disabled={saving}
                      onSwitched={async (config) => {
                        await configSWR.mutate(config, { revalidate: false });
                      }}
                    />
                  ) : (
                    <Flexbox className={styles.displayName} gap={6}>
                      <Text className={styles.fieldLabel} fontSize={12}>
                        {t('platformManagement.models.displayName.label')}
                      </Text>
                      <Input
                        defaultValue={item.displayName}
                        disabled={saving}
                        key={item.displayName}
                        maxLength={100}
                        placeholder={t('platformManagement.models.displayName.placeholder')}
                        onPressEnter={(event) => event.currentTarget.blur()}
                        onBlur={(event) =>
                          updateDraft(setModelDisplayName(draft, scope, item, event.target.value))
                        }
                      />
                    </Flexbox>
                  )}
                  <Flexbox align={'center'} gap={4}>
                    <Text fontSize={12}>VIP</Text>
                    <Switch
                      aria-label={t('platformManagement.users.vipModel')}
                      checked={isVipModel(draft, item)}
                      disabled={saving}
                      onChange={(vip) => updateDraft(setModelVip(draft, item, vip))}
                    />
                  </Flexbox>
                  <Switch
                    checked={item.enabled}
                    disabled={saving || isProfessionalChannel}
                    onChange={(enabled) => {
                      if (!enabled) {
                        setRetirementSource(JSON.stringify([item.provider, item.model]));
                        document
                          .getElementById('global-model-retirement')
                          ?.scrollIntoView({ behavior: 'smooth' });
                        return;
                      }
                      if (
                        draft.retirements?.some(
                          (r) =>
                            r.source.model === item.model && r.source.provider === item.provider,
                        )
                      ) {
                        toast.warning(t('platformManagement.models.migration.alreadyRetired'));
                        return;
                      }
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
                      disabled={saving || !item.enabled || isDefault}
                      size={'small'}
                      onClick={() => updateDraft(setModelDisplayDefault(draft, scope, item))}
                    >
                      {isDefault
                        ? t('platformManagement.models.default.current')
                        : t('platformManagement.models.default.action')}
                    </Button>
                    <Button
                      disabled={saving || index === 0}
                      icon={<Icon icon={ArrowUpIcon} />}
                      size={'small'}
                      onClick={() => updateDraft(moveModelDisplayItem(draft, scope, index, -1))}
                    />
                    <Button
                      disabled={saving || index === draft[scope].length - 1}
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

      <TaskModelMigration
        config={configSWR.data || draft}
        disabled={saving}
        options={optionsSWR.data || []}
        requestedSource={retirementSource}
        onSaved={async (config) => {
          await configSWR.mutate(config, { revalidate: false });
          await useAiInfraStore.getState().refreshAiProviderRuntimeState();
        }}
      />
    </Flexbox>
  );
});

ModelDisplaySettings.displayName = 'ModelDisplaySettings';

export default ModelDisplaySettings;
