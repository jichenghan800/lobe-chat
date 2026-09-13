'use client';

import { Block, Flexbox } from '@lobehub/ui';
import { Button, confirmModal, Select, Text, toast } from '@lobehub/ui/base-ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncError from '@/components/AsyncError';
import { useClientDataSWR } from '@/libs/swr';
import { cottiModelDisplayService } from '@/services/cottiModelDisplay';
import type { ModelDisplayConfig, ModelDisplayOption } from '@/types/modelDisplay';

import { sharedStyles } from './sharedStyle';

interface Props {
  config: ModelDisplayConfig;
  disabled: boolean;
  onSaved: (config: ModelDisplayConfig) => Promise<void>;
  options: ModelDisplayOption[];
  requestedSource?: string;
}

const modelKey = (r: { model: string; provider: string }) => JSON.stringify([r.provider, r.model]);

export default function TaskModelMigration({
  config,
  disabled,
  onSaved,
  options,
  requestedSource,
}: Props) {
  const { t } = useTranslation('setting');
  const [sourceKey, setSourceKey] = useState<string>();
  const [targetKey, setTargetKey] = useState<string>();
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (requestedSource) {
      setSourceKey(requestedSource);
      setTargetKey(undefined);
    }
  }, [requestedSource]);
  const sources = [
    ...new Map([...config.agent, ...config.chat, ...options].map((r) => [modelKey(r), r])).values(),
  ];
  const source = sources.find((r) => modelKey(r) === sourceKey);
  const targets = config.agent.filter(
    (r) =>
      r.enabled &&
      config.chat.some((c) => c.enabled && modelKey(c) === modelKey(r)) &&
      !config.retirements?.some((x) => modelKey(x.source) === modelKey(r)) &&
      modelKey(r) !== sourceKey &&
      options.some((o) => modelKey(o) === modelKey(r)),
  );
  const target = targets.find((r) => modelKey(r) === targetKey);
  const preview = useClientDataSWR(
    source ? ['cotti', 'task-model-migration', sourceKey] : null,
    () => cottiModelDisplayService.previewTaskMigration(source!),
    { revalidateOnFocus: false },
  );
  const label = (r: { model: string; provider: string; displayName?: string }) =>
    `${r.displayName || r.model} (${r.provider}/${r.model})`;
  const execute = async () => {
    if (!source || !target || !preview.data) return;
    setSaving(true);
    try {
      const result = await cottiModelDisplayService.retireAndMigrateTasks({
        source,
        target,
        revision: preview.data.revision,
      });
      await onSaved(result.config);
      await preview.mutate();
      toast.success(t('platformManagement.models.migration.done', { count: result.migratedCount }));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('platformManagement.models.migration.failed'),
      );
      await preview.mutate();
    } finally {
      setSaving(false);
    }
  };
  return (
    <Block
      className={sharedStyles.card}
      gap={12}
      id="global-model-retirement"
      padding={20}
      variant="outlined"
    >
      <Text className={sharedStyles.sectionTitle}>
        {t('platformManagement.models.migration.title')}
      </Text>
      <Text>{t('platformManagement.models.migration.description')}</Text>
      <Text>{t('platformManagement.models.migration.boundary')}</Text>
      {disabled && <Text>{t('platformManagement.models.migration.saveFirst')}</Text>}
      <Flexbox horizontal gap={12} wrap="wrap">
        <Select
          aria-label={t('platformManagement.models.migration.source')}
          disabled={disabled || saving}
          options={sources.map((r) => ({ label: label(r), value: modelKey(r) }))}
          placeholder={t('platformManagement.models.migration.source')}
          value={sourceKey}
          onChange={(v) => {
            setSourceKey(v);
            setTargetKey(undefined);
          }}
        />
        <Select
          aria-label={t('platformManagement.models.migration.target')}
          disabled={disabled || saving || !source}
          options={targets.map((r) => ({ label: label(r), value: modelKey(r) }))}
          placeholder={t('platformManagement.models.migration.target')}
          value={targetKey}
          onChange={setTargetKey}
        />
      </Flexbox>
      {preview.error ? (
        <AsyncError error={preview.error} onRetry={() => void preview.mutate()} />
      ) : (
        preview.data && (
          <>
            <Text>
              {t('platformManagement.models.migration.impact', {
                count: preview.data.taskCount,
                running: preview.data.runningCount,
                agents: preview.data.agentCount,
                topics: preview.data.topicCount,
              })}
            </Text>
            <Text>{t('platformManagement.models.migration.listHint')}</Text>
            <div style={{ maxHeight: 240, overflow: 'auto' }}>
              {preview.data.tasks.map((task) => (
                <div key={task.id}>
                  <a href={`/task/${task.id}`} rel="noopener noreferrer" target="_blank">
                    {task.identifier} · {task.name || task.identifier}
                  </a>
                  {' · '}
                  {task.status}
                  {' · '}
                  {task.workspaceId || t('platformManagement.models.migration.personal')}
                </div>
              ))}
            </div>
          </>
        )
      )}
      <Button
        loading={saving}
        disabled={
          disabled ||
          !source ||
          !target ||
          !preview.data ||
          !!preview.error ||
          preview.isValidating ||
          saving
        }
        onClick={() =>
          confirmModal({
            title: t('platformManagement.models.migration.confirmTitle'),
            content: t('platformManagement.models.migration.confirm', {
              count: preview.data?.taskCount,
              agents: preview.data?.agentCount,
              topics: preview.data?.topicCount,
              source: source && label(source),
              target: target && label(target),
            }),
            okText: t('platformManagement.models.migration.action'),
            cancelText: t('cancel', { ns: 'common' }),
            onOk: execute,
          })
        }
      >
        {t('platformManagement.models.migration.action')}
      </Button>
    </Block>
  );
}
