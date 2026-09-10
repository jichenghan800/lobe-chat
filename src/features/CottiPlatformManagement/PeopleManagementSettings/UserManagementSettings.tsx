'use client';

import { Block, Empty, Flexbox, Input } from '@lobehub/ui';
import {
  Button,
  createModal,
  Select,
  Skeleton,
  Switch,
  Text,
  toast,
  useModalContext,
} from '@lobehub/ui/base-ui';
import { useDebounce } from 'ahooks';
import { Table } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncError from '@/components/AsyncError';
import { useClientDataSWR } from '@/libs/swr';
import { cottiUsersService } from '@/services/cottiUsers';

import { sharedStyles } from '../sharedStyle';

type UserRow = Awaited<ReturnType<typeof cottiUsersService.list>>['items'][number];

const EditUserPolicy = ({ user, onSaved }: { user: UserRow; onSaved: () => Promise<unknown> }) => {
  const { t } = useTranslation('setting');
  const { close } = useModalContext();
  const [draft, setDraft] = useState({
    vip: user.vip,
    agentEnabled: user.agentEnabled,
    amount: user.topicLimitFen == null ? '' : String(user.topicLimitFen / 100),
  });
  const [saving, setSaving] = useState(false);
  const amount = draft.amount.trim();
  const valid =
    !amount ||
    (/^\d+(?:\.\d{1,2})?$/.test(amount) && Number(amount) >= 0.01 && Number(amount) <= 1_000_000);
  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await cottiUsersService.update({
        userId: user.id,
        vip: draft.vip,
        agentEnabled: draft.agentEnabled,
        topicLimitFen: amount ? Math.round(Number(amount) * 100) : null,
      });
      await onSaved();
      toast.success(t('platformManagement.users.saved'));
      close();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('platformManagement.users.failed'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Flexbox gap={20}>
      <Text>{user.fullName || user.username || user.email || user.id}</Text>
      <Flexbox horizontal justify={'space-between'}>
        <Text>{t('platformManagement.users.vip')}</Text>
        <Switch
          checked={draft.vip}
          disabled={saving}
          onChange={(vip) => setDraft({ ...draft, vip })}
        />
      </Flexbox>
      <Flexbox horizontal justify={'space-between'}>
        <Text>{t('platformManagement.users.agent')}</Text>
        <Switch
          checked={draft.agentEnabled}
          disabled={saving}
          onChange={(agentEnabled) => setDraft({ ...draft, agentEnabled })}
        />
      </Flexbox>
      <Flexbox gap={8}>
        <Text>{t('platformManagement.users.limit')}</Text>
        <Input
          aria-label={t('platformManagement.users.limit')}
          disabled={saving}
          inputMode={'decimal'}
          placeholder={t('platformManagement.users.inherit')}
          value={draft.amount}
          onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
        />
        {!valid && <Text>{t('platformManagement.topicBudget.invalid')}</Text>}
      </Flexbox>
      <Text fontSize={12}>{t('platformManagement.users.policyNote')}</Text>
      <Flexbox horizontal gap={8} justify={'flex-end'}>
        <Button disabled={saving} onClick={close}>
          {t('platformManagement.users.cancel')}
        </Button>
        <Button disabled={!valid} loading={saving} type={'primary'} onClick={() => void save()}>
          {t('platformManagement.users.save')}
        </Button>
      </Flexbox>
    </Flexbox>
  );
};

export const UserManagementSettings = () => {
  const { t } = useTranslation('setting');
  const [filter, setFilter] = useState({ query: '', vip: 'all', agent: 'all', page: 1 });
  const debounced = useDebounce(filter.query, { wait: 300 });
  const input = {
    page: filter.page,
    pageSize: 20,
    query: debounced,
    vip: filter.vip === 'all' ? undefined : filter.vip === 'yes',
    agentEnabled: filter.agent === 'all' ? undefined : filter.agent === 'yes',
  };
  const { data, error, mutate } = useClientDataSWR(
    ['cotti', 'users', input],
    () => cottiUsersService.list(input),
    { revalidateOnFocus: false },
  );
  const options = [
    { label: t('platformManagement.users.all'), value: 'all' },
    { label: t('platformManagement.users.yes'), value: 'yes' },
    { label: t('platformManagement.users.no'), value: 'no' },
  ];
  return (
    <Block className={sharedStyles.card} gap={16} padding={20} variant={'outlined'}>
      <Text className={sharedStyles.sectionTitle}>{t('platformManagement.users.title')}</Text>
      <Text className={sharedStyles.copy}>{t('platformManagement.users.desc')}</Text>
      <Flexbox horizontal gap={12} wrap={'wrap'}>
        <Input
          allowClear
          placeholder={t('platformManagement.users.search')}
          value={filter.query}
          onChange={(e) => setFilter({ ...filter, query: e.target.value, page: 1 })}
        />
        <Flexbox
          horizontal
          align={'center'}
          gap={8}
          style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          <Text>VIP</Text>
          <Select
            options={options}
            value={filter.vip}
            onChange={(vip) => setFilter({ ...filter, vip, page: 1 })}
          />
        </Flexbox>
        <Flexbox
          horizontal
          align={'center'}
          gap={8}
          style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          <Text>Agent</Text>
          <Select
            options={options}
            value={filter.agent}
            onChange={(agent) => setFilter({ ...filter, agent, page: 1 })}
          />
        </Flexbox>
      </Flexbox>
      {error ? (
        <AsyncError error={error} onRetry={() => void mutate()} />
      ) : !data ? (
        <Skeleton height={240} />
      ) : (
        <Table<UserRow>
          dataSource={data.items}
          locale={{ emptyText: <Empty description={t('platformManagement.users.empty')} /> }}
          rowKey={'id'}
          scroll={{ x: 980 }}
          size={'middle'}
          columns={[
            {
              title: t('platformManagement.users.identity'),
              key: 'identity',
              render: (_, u) => (
                <Flexbox gap={4}>
                  <Text>{u.fullName || u.username || u.email || u.id}</Text>
                  <Text fontSize={12}>{u.email || '—'}</Text>
                  <Text fontSize={12}>{u.phone || '—'}</Text>
                </Flexbox>
              ),
            },
            {
              title: 'VIP',
              dataIndex: 'vip',
              render: (v) => t(v ? 'platformManagement.users.yes' : 'platformManagement.users.no'),
            },
            {
              title: t('platformManagement.users.agent'),
              dataIndex: 'agentEnabled',
              render: (v) => t(v ? 'platformManagement.users.yes' : 'platformManagement.users.no'),
            },
            {
              title: t('platformManagement.users.limit'),
              dataIndex: 'topicLimitFen',
              render: (v) =>
                v == null ? t('platformManagement.users.inherit') : `¥${(v / 100).toFixed(2)}`,
            },
            {
              title: t('platformManagement.users.login'),
              dataIndex: 'banned',
              render: (v) =>
                t(v ? 'platformManagement.users.banned' : 'platformManagement.users.normal'),
            },
            {
              title: t('platformManagement.users.active'),
              dataIndex: 'lastActiveAt',
              render: (v) => new Date(v).toLocaleString(),
            },
            {
              title: t('platformManagement.users.actions'),
              key: 'actions',
              render: (_, user) => (
                <Button
                  size={'small'}
                  onClick={() =>
                    createModal({
                      title: t('platformManagement.users.edit'),
                      content: <EditUserPolicy user={user} onSaved={() => mutate()} />,
                      footer: null,
                      width: 480,
                    })
                  }
                >
                  {t('platformManagement.users.edit')}
                </Button>
              ),
            },
          ]}
          pagination={{
            current: filter.page,
            pageSize: 20,
            total: data.total,
            showSizeChanger: false,
            onChange: (page) => setFilter({ ...filter, page }),
          }}
        />
      )}
    </Block>
  );
};
