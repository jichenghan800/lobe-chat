'use client';

import { Block, Empty, Flexbox, Icon } from '@lobehub/ui';
import {
  AutoComplete,
  Button,
  confirmModal,
  Skeleton,
  Tag,
  Text,
  toast,
} from '@lobehub/ui/base-ui';
import { useDebounce } from 'ahooks';
import { Input, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ShieldPlusIcon, Trash2Icon } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncError from '@/components/AsyncError';
import { sharedStyles } from '@/features/CottiPlatformManagement/sharedStyle';
import { useClientDataSWR } from '@/libs/swr';
import { cottiPeopleManagementService } from '@/services/cottiPeopleManagement';
import type { CottiPlatformAdministrator } from '@/types/cotti/peopleManagement';

import { styles } from './style';

const PlatformAdminSettings = memo(() => {
  const { t } = useTranslation('setting');
  const [query, setQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [note, setNote] = useState('');
  const [pendingId, setPendingId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const debouncedQuery = useDebounce(query, { wait: 300 });
  const detailSWR = useClientDataSWR(
    ['cotti', 'people-management', 'detail'],
    () => cottiPeopleManagementService.getDetail(),
    { revalidateOnFocus: false },
  );
  const searchSWR = useClientDataSWR(
    debouncedQuery.trim().length >= 2
      ? ['cotti', 'people-management', 'user-search', debouncedQuery.trim()]
      : null,
    () => cottiPeopleManagementService.searchUsers(debouncedQuery.trim()),
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );
  const options = useMemo(
    () =>
      (searchSWR.data || []).map((user) => ({
        label: `${user.fullName || user.username || user.normalizedEmail || user.email || user.id} · ${user.normalizedEmail || user.email || user.id}`,
        value: user.id,
      })),
    [searchSWR.data],
  );

  const handleAdd = async () => {
    if (!selectedUserId) {
      toast.warning(t('platformManagement.people.admin.feedback.userRequired'));
      return;
    }

    setSaving(true);
    try {
      await cottiPeopleManagementService.addAdministrator(selectedUserId, note.trim() || undefined);
      setQuery('');
      setSelectedUserId('');
      setNote('');
      await detailSWR.mutate();
      toast.success(t('platformManagement.people.admin.feedback.added'));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('platformManagement.people.feedback.saveFailed'),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = useCallback(
    (record: CottiPlatformAdministrator) => {
      if (!record.editable) return;
      confirmModal({
        content: t('platformManagement.people.admin.deleteConfirm'),
        okButtonProps: { danger: true },
        okText: t('platformManagement.people.actions.delete'),
        onOk: async () => {
          setPendingId(record.id);
          try {
            await cottiPeopleManagementService.removeAdministrator(record.id);
            await detailSWR.mutate();
            toast.success(t('platformManagement.people.admin.feedback.removed'));
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : t('platformManagement.people.feedback.saveFailed'),
            );
          } finally {
            setPendingId(undefined);
          }
        },
        title: t('platformManagement.people.actions.delete'),
      });
    },
    [detailSWR, t],
  );

  const columns = useMemo<ColumnsType<CottiPlatformAdministrator>>(
    () => [
      {
        render: (_, record) => (
          <Flexbox gap={2} style={{ minWidth: 0 }}>
            <Text ellipsis weight={500}>
              {record.user?.fullName || record.user?.username || record.value}
            </Text>
            {record.user && (
              <Text ellipsis className={sharedStyles.copy} fontSize={12}>
                {record.user.normalizedEmail || record.user.email || record.user.id}
              </Text>
            )}
          </Flexbox>
        ),
        title: t('platformManagement.people.admin.columns.person'),
        width: '42%',
      },
      {
        render: (_, record) => (
          <Tag>{t(`platformManagement.people.admin.source.${record.source}`)}</Tag>
        ),
        title: t('platformManagement.people.admin.columns.source'),
        width: 150,
      },
      {
        dataIndex: 'note',
        render: (text?: null | string) => text || '-',
        title: t('platformManagement.people.admin.columns.note'),
      },
      {
        render: (_, record) => (
          <Button
            danger
            disabled={!record.editable}
            icon={<Icon icon={Trash2Icon} />}
            loading={pendingId === record.id}
            size={'small'}
            onClick={() => handleRemove(record)}
          />
        ),
        title: t('platformManagement.people.admin.columns.actions'),
        width: 70,
      },
    ],
    [handleRemove, pendingId, t],
  );

  if (detailSWR.error) {
    return (
      <AsyncError
        error={detailSWR.error}
        variant={'block'}
        onRetry={() => void detailSWR.mutate()}
      />
    );
  }
  if (!detailSWR.data) return <Skeleton height={240} />;

  return (
    <Block className={sharedStyles.card} gap={16} padding={20} variant={'outlined'}>
      <Flexbox className={sharedStyles.sectionHeader} gap={4}>
        <Text className={sharedStyles.sectionTitle}>
          {t('platformManagement.people.admin.title')}
        </Text>
        <Text className={sharedStyles.copy} fontSize={12}>
          {t('platformManagement.people.admin.desc')}
        </Text>
      </Flexbox>
      <div className={styles.formGrid}>
        <div />
        <AutoComplete
          allowClear
          filter={null}
          options={options}
          placeholder={t('platformManagement.people.admin.searchPlaceholder')}
          value={query}
          onChange={(nextValue) => {
            const selected = options.find((option) => option.value === nextValue);
            setQuery(selected ? selected.label : nextValue);
            setSelectedUserId(selected?.value || '');
          }}
        />
        <Input
          allowClear
          maxLength={200}
          placeholder={t('platformManagement.people.admin.notePlaceholder')}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <Button
          icon={<Icon icon={ShieldPlusIcon} />}
          loading={saving}
          type={'primary'}
          onClick={() => void handleAdd()}
        >
          {t('platformManagement.people.admin.actions.add')}
        </Button>
      </div>
      <Table
        className={styles.table}
        columns={columns}
        dataSource={detailSWR.data.administrators}
        locale={{ emptyText: <Empty description={t('platformManagement.people.admin.empty')} /> }}
        pagination={{ pageSize: 10, showSizeChanger: false }}
        rowKey={'id'}
        scroll={{ x: 760 }}
        size={'middle'}
      />
    </Block>
  );
});

PlatformAdminSettings.displayName = 'PlatformAdminSettings';

export default PlatformAdminSettings;
