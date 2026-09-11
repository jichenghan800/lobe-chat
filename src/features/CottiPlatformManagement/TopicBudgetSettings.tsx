'use client';

import { Block, Flexbox, Input } from '@lobehub/ui';
import { Skeleton, Switch, Text, toast } from '@lobehub/ui/base-ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncError from '@/components/AsyncError';
import { useClientDataSWR } from '@/libs/swr';
import { cottiTopicBudgetService } from '@/services/cottiTopicBudget';

import { sharedStyles } from './sharedStyle';
import { useConfigAutosave } from './useConfigAutosave';

export const TopicBudgetSettings = () => {
  const { t } = useTranslation('setting');
  const { data, error, mutate } = useClientDataSWR(
    ['cotti', 'topic-budget'],
    cottiTopicBudgetService.getConfig,
    { revalidateOnFocus: false },
  );
  const [amount, setAmount] = useState<string>();
  const {
    draft: current,
    saving,
    status,
    error: saveError,
    save,
    retry,
  } = useConfigAutosave(data, async (next) => {
    const saved = await cottiTopicBudgetService.updateConfig(next);
    await mutate(saved, { revalidate: false });
    setAmount(undefined);
    return saved;
  });
  useEffect(() => {
    if (status === 'failed') {
      setAmount(undefined);
      toast.error(t('platformManagement.models.autoSave.failed'));
    }
  }, [status, t]);
  if (error) return <AsyncError error={error} variant={'block'} onRetry={() => void mutate()} />;
  if (!current) return <Skeleton height={180} />;
  const value = amount ?? String(current.limitFen / 100);
  const limitFen = Math.round(Number(value) * 100);
  const valid = /^\d+(?:\.\d{1,2})?$/.test(value) && limitFen > 0 && limitFen <= 100_000_000;
  return (
    <Block className={sharedStyles.card} gap={16} padding={20} variant={'outlined'}>
      <Flexbox horizontal align={'center'} justify={'space-between'}>
        <Text className={sharedStyles.sectionTitle}>
          {t('platformManagement.topicBudget.title')}
        </Text>
        <Switch
          aria-label={t('platformManagement.topicBudget.title')}
          checked={current.enabled}
          disabled={saving}
          onChange={(enabled) => void save({ ...current, enabled })}
        />
      </Flexbox>
      <Text className={sharedStyles.copy}>{t('platformManagement.topicBudget.desc')}</Text>
      <Flexbox gap={8}>
        <Text>{t('platformManagement.topicBudget.amount')}</Text>
        <Input
          aria-label={t('platformManagement.topicBudget.amount')}
          disabled={saving}
          inputMode={'decimal'}
          value={value}
          onChange={(e) => setAmount(e.target.value)}
          onPressEnter={(e) => e.currentTarget.blur()}
          onBlur={() => {
            if (valid) void save({ ...current, limitFen });
          }}
        />
        {!valid && <Text>{t('platformManagement.topicBudget.invalid')}</Text>}
      </Flexbox>
      <Text className={sharedStyles.copy} fontSize={12}>
        {t('platformManagement.topicBudget.note')}
      </Text>
      <Text aria-live={'polite'} fontSize={12}>
        {t(`platformManagement.models.autoSave.${status}`)}
      </Text>
      {status === 'failed' && (
        <AsyncError error={saveError} variant={'inline'} onRetry={() => void retry()} />
      )}
    </Block>
  );
};
