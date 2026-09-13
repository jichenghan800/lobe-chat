'use client';

import { Flexbox, Input } from '@lobehub/ui';
import { Button, confirmModal, Text, toast } from '@lobehub/ui/base-ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { mutate } from 'swr';

import { cottiTopicOverviewService } from '@/services/cottiTopicOverview';
import type { CottiTopicManagementInput } from '@/types/cotti/topicOverview';

import { useCottiTopicAccounting } from './hooks';
import { styles } from './style';

export const topicCny = (usd: number) =>
  usd > 0 && usd * 7.12 < 0.01 ? '<¥0.01' : `¥${(usd * 7.12).toFixed(2)}`;

export const TopicManagement = ({ topicId, onClose }: { topicId: string; onClose: () => void }) => {
  const { t } = useTranslation('topic');
  const swr = useCottiTopicAccounting(topicId);
  const data = swr.data;
  const [amount, setAmount] = useState('');
  const [pending, setPending] = useState(false);
  useEffect(() => {
    setAmount(data?.topicLimitFen == null ? '' : String(data.topicLimitFen / 100));
  }, [data?.topicLimitFen]);
  const valid =
    !amount.trim() ||
    (/^\d+(?:\.\d{1,2})?$/.test(amount) && Number(amount) >= 0.01 && Number(amount) <= 1000000);
  const save = async (action: CottiTopicManagementInput['action']) => {
    if (pending || !valid) return;
    setPending(true);
    try {
      const updated = await cottiTopicOverviewService.manage({
        topicId,
        action,
        limitFen: amount.trim() ? Math.round(Number(amount) * 100) : null,
      });
      await swr.mutate(updated, { revalidate: false });
      await mutate(
        (key) => Array.isArray(key) && key[0] === 'cotti' && key[1] === 'topic-overview',
      );
      toast.success(t('overview.manage.saved'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('overview.manage.failed'));
    } finally {
      setPending(false);
    }
  };
  const confirm = (action: 'freeze' | 'unfreeze' | 'setLimitAndUnfreeze') =>
    confirmModal({
      title: t(`overview.manage.${action}`),
      okText: t('overview.manage.confirm'),
      cancelText: t('overview.manage.cancel'),
      content: t(
        action === 'freeze' ? 'overview.manage.freezeNotice' : 'overview.manage.unfreezeNotice',
      ),
      onOk: () => save(action),
    });
  return (
    <Flexbox className={styles.management} gap={16}>
      <Flexbox horizontal align={'center'} justify={'space-between'}>
        <Text strong>{t('overview.manage.title')}</Text>
        <Button size={'small'} type={'text'} onClick={onClose}>
          {t('overview.manage.close')}
        </Button>
      </Flexbox>
      {swr.error && <Text>{t('overview.manage.failed')}</Text>}
      {!data ? (
        <Text>{t('overview.manage.loading')}</Text>
      ) : (
        <>
          <Text strong>
            {t('overview.manage.spent')}: {topicCny(data.costUsd)}{' '}
            {!data.costComplete && t('overview.manage.incomplete')}
          </Text>
          <Text>
            {t('overview.manage.limit')}:{' '}
            {data.enabled ? `¥${(data.limitFen / 100).toFixed(2)}` : t('overview.manage.disabled')}{' '}
            · {t(`overview.manage.source.${data.limitSource}`)}
          </Text>
          <Text>
            {data.freeze
              ? t(`overview.manage.reason.${data.freeze.reason}`)
              : t('overview.manage.active')}
          </Text>
          {data.freeze && (
            <Text fontSize={12} type={'secondary'}>
              {new Date(data.freeze.createdAt).toLocaleString()}
              {data.freeze.reason === 'context' &&
                ` · ${data.freeze.estimatedInputTokens.toLocaleString()} Token / ${data.freeze.inputTokenLimit.toLocaleString()}`}
            </Text>
          )}
          <Text fontSize={12} type={'secondary'}>
            {t('overview.manage.amountHint')}
          </Text>
          <Input
            aria-label={t('overview.manage.topicLimit')}
            disabled={pending}
            inputMode={'decimal'}
            placeholder={t('overview.manage.inherit')}
            status={valid ? undefined : 'error'}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <Flexbox horizontal gap={8} wrap={'wrap'}>
            <Button disabled={!valid || pending} onClick={() => void save('setLimit')}>
              {t('overview.manage.save')}
            </Button>
            {data.freeze && data.freeze.reason !== 'context' && (
              <Button disabled={!valid || pending} onClick={() => confirm('setLimitAndUnfreeze')}>
                {t('overview.manage.setLimitAndUnfreeze')}
              </Button>
            )}
            <Button disabled={pending} onClick={() => confirm(data.freeze ? 'unfreeze' : 'freeze')}>
              {t(data.freeze ? 'overview.manage.unfreeze' : 'overview.manage.freeze')}
            </Button>
          </Flexbox>
          <Text fontSize={12} type={'secondary'}>
            {t('overview.manage.priceHint')}
          </Text>
          {data.models.map((model) => (
            <Flexbox gap={4} key={`${model.provider}/${model.model}`}>
              <Text strong style={{ overflowWrap: 'anywhere' }}>
                {model.model || t('overview.modelNotRecorded')}
              </Text>
              <Text fontSize={12}>
                {model.provider} ·{' '}
                {model.costUsd == null ? t('overview.manage.unknown') : topicCny(model.costUsd)}
              </Text>
              <Text fontSize={12}>
                {t('overview.manage.input')}: {model.inputTokens.toLocaleString()} ·{' '}
                {t('overview.manage.output')}: {model.outputTokens.toLocaleString()}
              </Text>
              <Text fontSize={12}>
                {t('overview.manage.cacheRead')}: {model.cachedTokens.toLocaleString()} ·{' '}
                {t('overview.manage.cacheWrite')}: {model.cacheWriteTokens.toLocaleString()}
              </Text>
              <Text fontSize={12} type={'secondary'}>
                {t('overview.manage.coverage', {
                  priced: model.pricedRecords,
                  total: model.records,
                })}
              </Text>
            </Flexbox>
          ))}
        </>
      )}
    </Flexbox>
  );
};

export const TopicManagementHeader = ({
  topicId,
  onOpen,
}: {
  topicId: string;
  onOpen: () => void;
}) => {
  const { t } = useTranslation('topic');
  const { data } = useCottiTopicAccounting(topicId);
  return (
    <Button size={'small'} onClick={onOpen}>
      {data
        ? `${topicCny(data.costUsd)} · ${t(data.freeze ? 'overview.manage.frozen' : 'overview.manage.active')}`
        : t('overview.manage.title')}
    </Button>
  );
};
