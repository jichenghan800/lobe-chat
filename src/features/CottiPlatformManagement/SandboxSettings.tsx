import { Block, Flexbox, Input } from '@lobehub/ui';
import { Skeleton, Text } from '@lobehub/ui/base-ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncError from '@/components/AsyncError';
import { useClientDataSWR } from '@/libs/swr';
import { cottiSandboxService } from '@/services/cottiSandbox';

import { sharedStyles } from './sharedStyle';
import { useConfigAutosave } from './useConfigAutosave';

export const SandboxSettings = () => {
  const { t } = useTranslation('setting');
  const { data, error, mutate } = useClientDataSWR(
    ['cotti', 'sandbox-capacity'],
    cottiSandboxService.getConfig,
    { revalidateOnFocus: true, refreshInterval: 10_000 },
  );
  const [input, setInput] = useState<string>();
  const {
    draft,
    save,
    saving,
    status,
    error: saveError,
    retry,
  } = useConfigAutosave(data, async (next) => {
    const saved = await cottiSandboxService.updateConfig(next.maxSessions);
    await mutate(saved, { revalidate: false });
    setInput(undefined);
    return saved;
  });
  useEffect(() => {
    if (status === 'failed') setInput(undefined);
  }, [status]);
  if (error) return <AsyncError error={error} variant={'block'} onRetry={() => void mutate()} />;
  if (!draft) return <Skeleton height={180} />;
  const value = input ?? String(draft.maxSessions);
  const maxSessions = Number(value);
  const valid = /^\d+$/.test(value) && maxSessions >= 1 && maxSessions <= 100;
  return (
    <Block className={sharedStyles.card} gap={16} padding={20} variant={'outlined'}>
      <Text className={sharedStyles.sectionTitle}>{t('platformManagement.sandbox.title')}</Text>
      {!draft.active && <Text>{t('platformManagement.sandbox.inactive')}</Text>}
      <Flexbox gap={8}>
        <Text>{t('platformManagement.sandbox.limit')}</Text>
        <Input
          aria-label={t('platformManagement.sandbox.limit')}
          disabled={saving}
          inputMode={'numeric'}
          value={value}
          onChange={(e) => setInput(e.target.value)}
          onPressEnter={(e) => e.currentTarget.blur()}
          onBlur={() => {
            if (valid && maxSessions !== draft.maxSessions) void save({ ...draft, maxSessions });
          }}
        />
        {!valid && <Text role={'alert'}>{t('platformManagement.sandbox.invalid')}</Text>}
      </Flexbox>
      <Text>
        {t('platformManagement.sandbox.usage', {
          count: draft.reservedSessions,
          limit: draft.maxSessions,
        })}
      </Text>
      <Text className={sharedStyles.copy}>{t('platformManagement.sandbox.note')}</Text>
      <Text className={sharedStyles.copy}>{t('platformManagement.sandbox.reservationNote')}</Text>
      <Text aria-live={'polite'} fontSize={12}>
        {t(`platformManagement.models.autoSave.${status}`)}
      </Text>
      {status === 'failed' && (
        <AsyncError error={saveError} variant={'inline'} onRetry={() => void retry()} />
      )}
    </Block>
  );
};
