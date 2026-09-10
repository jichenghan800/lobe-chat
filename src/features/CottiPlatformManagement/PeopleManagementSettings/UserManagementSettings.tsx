'use client';

import { Block, Empty, Flexbox, Icon, Input, Tooltip } from '@lobehub/ui';
import { Button, Popover, Select, Skeleton, Switch, Text, toast } from '@lobehub/ui/base-ui';
import { useDebounce } from 'ahooks';
import { Table } from 'antd';
import { MoreHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncError from '@/components/AsyncError';
import { useSingleton } from '@/hooks/useSingleton';
import { useClientDataSWR } from '@/libs/swr';
import { cottiUsersService } from '@/services/cottiUsers';

import { sharedStyles } from '../sharedStyle';

type UserRow = Awaited<ReturnType<typeof cottiUsersService.list>>['items'][number];

const TopicLimitCell = ({
  user,
  disabled,
  onSave,
}: {
  user: UserRow;
  disabled: boolean;
  onSave: (limit: number | null) => Promise<boolean>;
}) => {
  const { t } = useTranslation('setting');
  const [draft, setDraft] = useState(() =>
    user.topicLimitFen == null ? '' : String(user.topicLimitFen / 100),
  );
  const skipBlur = useRef(false);
  useEffect(() => {
    setDraft(user.topicLimitFen == null ? '' : String(user.topicLimitFen / 100));
  }, [user.topicLimitFen]);
  const amount = draft.trim();
  const valid =
    !amount ||
    (/^\d+(?:\.\d{1,2})?$/.test(amount) && Number(amount) >= 0.01 && Number(amount) <= 1_000_000);
  const save = async () => {
    if (skipBlur.current) {
      skipBlur.current = false;
      return;
    }
    if (!valid || disabled) return;
    const value = amount ? Math.round(Number(amount) * 100) : null;
    if (value !== user.topicLimitFen) await onSave(value);
  };
  return (
    <Tooltip
      title={
        valid
          ? t('platformManagement.users.limitHint')
          : t('platformManagement.topicBudget.invalid')
      }
    >
      <Input
        aria-invalid={!valid}
        aria-label={t('platformManagement.users.limit')}
        disabled={disabled}
        inputMode={'decimal'}
        placeholder={t('platformManagement.users.inherit')}
        size={'small'}
        status={valid ? undefined : 'error'}
        style={{ width: 148 }}
        value={draft}
        onBlur={() => void save()}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            skipBlur.current = true;
            setDraft(user.topicLimitFen == null ? '' : String(user.topicLimitFen / 100));
            e.currentTarget.blur();
          }
        }}
      />
    </Tooltip>
  );
};

const UserIdentity = ({ user }: { user: UserRow }) => {
  const { t } = useTranslation('setting');
  const details = (
    <Flexbox gap={8} style={{ maxWidth: 320, overflowWrap: 'anywhere' }}>
      <Text>
        {t('platformManagement.users.email')}: {user.email || '—'}
      </Text>
      <Text>
        {t('platformManagement.users.phone')}: {user.phone || '—'}
      </Text>
    </Flexbox>
  );
  return (
    <Flexbox horizontal align={'center'} gap={4} style={{ minWidth: 0 }}>
      <Tooltip title={details}>
        <Text
          style={{
            maxWidth: 230,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {user.fullName || user.username || user.email || user.id}
        </Text>
      </Tooltip>
      <Popover content={details} trigger={'click'}>
        <Button aria-label={t('platformManagement.users.contact')} size={'small'} type={'text'}>
          <Icon icon={MoreHorizontal} size={16} />
        </Button>
      </Popover>
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
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const savingIds = useSingleton(() => new Set<string>());
  const saveField = async (
    userId: string,
    patch: Omit<Parameters<typeof cottiUsersService.update>[0], 'userId'>,
  ) => {
    if (savingIds.has(userId)) return false;
    savingIds.add(userId);
    setPendingIds(new Set(savingIds));
    try {
      const policy = await cottiUsersService.update({ userId, ...patch });
      await mutate(
        (current) =>
          current
            ? {
                ...current,
                items: current.items.map((user) =>
                  user.id === userId ? { ...user, ...policy } : user,
                ),
              }
            : current,
        { revalidate: false },
      );
      toast.success(t('platformManagement.users.saved'));
      void mutate().catch(() => toast.error(t('platformManagement.users.refreshFailed')));
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('platformManagement.users.failed'));
      return false;
    } finally {
      savingIds.delete(userId);
      setPendingIds(new Set(savingIds));
    }
  };
  const options = [
    { label: t('platformManagement.users.all'), value: 'all' },
    { label: t('platformManagement.users.yes'), value: 'yes' },
    { label: t('platformManagement.users.no'), value: 'no' },
  ];
  return (
    <Block className={sharedStyles.card} gap={16} padding={20} variant={'outlined'}>
      <Text className={sharedStyles.sectionTitle}>{t('platformManagement.users.title')}</Text>
      <Text className={sharedStyles.copy}>{t('platformManagement.users.inlineDesc')}</Text>
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
          scroll={{ x: 1000 }}
          size={'small'}
          columns={[
            {
              title: t('platformManagement.users.identity'),
              key: 'identity',
              width: 280,
              render: (_, user) => <UserIdentity user={user} />,
            },
            {
              title: 'VIP',
              dataIndex: 'vip',
              width: 90,
              render: (_, user) => (
                <Switch
                  aria-label={t('platformManagement.users.vip')}
                  checked={user.vip}
                  disabled={pendingIds.has(user.id)}
                  onChange={(vip) => void saveField(user.id, { vip })}
                />
              ),
            },
            {
              title: t('platformManagement.users.agent'),
              dataIndex: 'agentEnabled',
              width: 130,
              render: (_, user) => (
                <Switch
                  aria-label={t('platformManagement.users.agent')}
                  checked={user.agentEnabled}
                  disabled={pendingIds.has(user.id)}
                  onChange={(agentEnabled) => void saveField(user.id, { agentEnabled })}
                />
              ),
            },
            {
              title: t('platformManagement.users.limit'),
              dataIndex: 'topicLimitFen',
              width: 190,
              render: (_, user) => (
                <TopicLimitCell
                  disabled={pendingIds.has(user.id)}
                  user={user}
                  onSave={(topicLimitFen) => saveField(user.id, { topicLimitFen })}
                />
              ),
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
              render: (v) => (
                <Text style={{ whiteSpace: 'nowrap' }}>{new Date(v).toLocaleString()}</Text>
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
