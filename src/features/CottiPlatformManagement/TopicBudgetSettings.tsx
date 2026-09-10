'use client';

import { Block, Flexbox, Input } from '@lobehub/ui';
import { Button, Skeleton, Switch, Text, toast } from '@lobehub/ui/base-ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncError from '@/components/AsyncError';
import { useClientDataSWR } from '@/libs/swr';
import { cottiTopicBudgetService } from '@/services/cottiTopicBudget';

import { sharedStyles } from './sharedStyle';

export const TopicBudgetSettings = () => {
  const { t } = useTranslation('setting');
  const { data, error, mutate } = useClientDataSWR(
    ['cotti', 'topic-budget'],
    cottiTopicBudgetService.getConfig,
    { revalidateOnFocus: false },
  );
  const [draft, setDraft] = useState<{ enabled: boolean; amount: string }>();
  const [saving, setSaving] = useState(false);
  if (error) return <AsyncError error={error} variant={'block'} onRetry={() => void mutate()} />;
  if (!data) return <Skeleton height={180} />;
  const current = draft ?? { enabled: data.enabled, amount: String(data.limitFen / 100) };
  const limitFen = Math.round(Number(current.amount) * 100);
  const valid =
    /^\d+(?:\.\d{1,2})?$/.test(current.amount) && limitFen > 0 && limitFen <= 100_000_000;
  const dirty = current.enabled !== data.enabled || limitFen !== data.limitFen;
  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      const saved = await cottiTopicBudgetService.updateConfig({
        enabled: current.enabled,
        limitFen,
      });
      await mutate(saved, { revalidate: false });
      setDraft(undefined);
      toast.success(t('platformManagement.topicBudget.saved'));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('platformManagement.topicBudget.failed'),
      );
    } finally {
      setSaving(false);
    }
  };
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
          onChange={(enabled) => setDraft({ ...current, enabled })}
        />
      </Flexbox>
      <Text className={sharedStyles.copy}>{t('platformManagement.topicBudget.desc')}</Text>
      <Flexbox gap={8}>
        <Text>{t('platformManagement.topicBudget.amount')}</Text>
        <Input
          aria-label={t('platformManagement.topicBudget.amount')}
          disabled={saving}
          inputMode={'decimal'}
          value={current.amount}
          onChange={(e) => setDraft({ ...current, amount: e.target.value })}
        />
        {!valid && <Text>{t('platformManagement.topicBudget.invalid')}</Text>}
      </Flexbox>
      <Text className={sharedStyles.copy} fontSize={12}>
        {t('platformManagement.topicBudget.note')}
      </Text>
      <Flexbox horizontal justify={'flex-end'}>
        <Button
          disabled={!dirty || !valid}
          loading={saving}
          type={'primary'}
          onClick={() => void save()}
        >
          {t('platformManagement.topicBudget.save')}
        </Button>
      </Flexbox>
    </Block>
  );
};
