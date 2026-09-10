'use client';

import { Block, Empty, Flexbox, Icon, Input } from '@lobehub/ui';
import { AutoComplete, Button, confirmModal, Tag, Text, toast } from '@lobehub/ui/base-ui';
import { useDebounce } from 'ahooks';
import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { UserRoundCheckIcon, UserXIcon } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { sharedStyles } from '@/features/CottiPlatformManagement/sharedStyle';
import { useClientDataSWR } from '@/libs/swr';
import { cottiPeopleManagementService } from '@/services/cottiPeopleManagement';
import type { CottiDisabledLoginUser } from '@/types/cotti/peopleManagement';

import { styles } from './style';

interface UserLoginStatusSettingsProps {
  disabledUsers: CottiDisabledLoginUser[];
  onChanged: () => Promise<unknown>;
}

interface DisableFormState {
  query: string;
  reason: string;
  userId: string;
}

const INITIAL_FORM: DisableFormState = { query: '', reason: '', userId: '' };

const UserLoginStatusSettings = memo<UserLoginStatusSettingsProps>(
  ({ disabledUsers, onChanged }) => {
    const { t } = useTranslation('setting');
    const [form, setForm] = useState(INITIAL_FORM);
    const [pendingUserId, setPendingUserId] = useState<string>();
    const [saving, setSaving] = useState(false);
    const debouncedQuery = useDebounce(form.query, { wait: 300 });
    const searchSWR = useClientDataSWR(
      debouncedQuery.trim().length >= 2
        ? ['cotti', 'people-management', 'login-user-search', debouncedQuery.trim()]
        : null,
      () => cottiPeopleManagementService.searchUsers(debouncedQuery.trim()),
      { revalidateOnFocus: false, revalidateOnReconnect: false },
    );
    const disabledUserIds = useMemo(
      () => new Set(disabledUsers.map(({ id }) => id)),
      [disabledUsers],
    );
    const options = useMemo(
      () =>
        (searchSWR.data || [])
          .filter((user) => !disabledUserIds.has(user.id))
          .map((user) => ({
            label: `${user.fullName || user.username || user.normalizedEmail || user.email || user.id} · ${user.normalizedEmail || user.email || user.id}`,
            value: user.id,
          })),
      [disabledUserIds, searchSWR.data],
    );

    const disableSelectedUser = () => {
      if (!form.userId) {
        toast.warning(t('platformManagement.people.loginControl.feedback.userRequired'));
        return;
      }

      confirmModal({
        content: t('platformManagement.people.loginControl.disableConfirm'),
        okButtonProps: { danger: true },
        okText: t('platformManagement.people.loginControl.actions.disable'),
        onOk: async () => {
          setSaving(true);
          try {
            await cottiPeopleManagementService.setUserLoginDisabled(
              form.userId,
              true,
              form.reason.trim() || undefined,
            );
            setForm(INITIAL_FORM);
            await onChanged();
            toast.success(t('platformManagement.people.loginControl.feedback.disabled'));
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : t('platformManagement.people.feedback.saveFailed'),
            );
          } finally {
            setSaving(false);
          }
        },
        title: t('platformManagement.people.loginControl.actions.disable'),
      });
    };

    const restoreUser = useCallback(
      (user: CottiDisabledLoginUser) => {
        confirmModal({
          content: t('platformManagement.people.loginControl.restoreConfirm'),
          okText: t('platformManagement.people.loginControl.actions.restore'),
          onOk: async () => {
            setPendingUserId(user.id);
            try {
              await cottiPeopleManagementService.setUserLoginDisabled(user.id, false);
              await onChanged();
              toast.success(t('platformManagement.people.loginControl.feedback.restored'));
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : t('platformManagement.people.feedback.saveFailed'),
              );
            } finally {
              setPendingUserId(undefined);
            }
          },
          title: t('platformManagement.people.loginControl.actions.restore'),
        });
      },
      [onChanged, t],
    );

    const columns = useMemo<ColumnsType<CottiDisabledLoginUser>>(
      () => [
        {
          render: (_, user) => (
            <Flexbox gap={2} style={{ minWidth: 0 }}>
              <Text ellipsis weight={500}>
                {user.fullName || user.username || user.normalizedEmail || user.email || user.id}
              </Text>
              <Text ellipsis className={sharedStyles.copy} fontSize={12}>
                {user.normalizedEmail || user.email || user.id}
              </Text>
            </Flexbox>
          ),
          title: t('platformManagement.people.loginControl.columns.person'),
          width: '38%',
        },
        {
          render: () => (
            <Tag color={'error'}>{t('platformManagement.people.loginControl.status.disabled')}</Tag>
          ),
          title: t('platformManagement.people.loginControl.columns.status'),
          width: 120,
        },
        {
          dataIndex: 'banReason',
          render: (reason?: null | string) => reason || '-',
          title: t('platformManagement.people.loginControl.columns.reason'),
        },
        {
          dataIndex: 'updatedAt',
          render: (value: Date | string) => new Date(value).toLocaleString(),
          title: t('platformManagement.people.loginControl.columns.updatedAt'),
          width: 180,
        },
        {
          render: (_, user) => (
            <Button
              icon={<Icon icon={UserRoundCheckIcon} />}
              loading={pendingUserId === user.id}
              size={'small'}
              onClick={() => restoreUser(user)}
            >
              {t('platformManagement.people.loginControl.actions.restore')}
            </Button>
          ),
          title: t('platformManagement.people.loginControl.columns.actions'),
          width: 120,
        },
      ],
      [pendingUserId, restoreUser, t],
    );

    return (
      <Block className={sharedStyles.card} gap={16} padding={20} variant={'outlined'}>
        <Flexbox className={sharedStyles.sectionHeader} gap={4}>
          <Text className={sharedStyles.sectionTitle}>
            {t('platformManagement.people.loginControl.title')}
          </Text>
          <Text className={sharedStyles.copy} fontSize={12}>
            {t('platformManagement.people.loginControl.desc')}
          </Text>
        </Flexbox>
        <div className={styles.formGrid}>
          <div />
          <AutoComplete
            allowClear
            filter={null}
            options={options}
            placeholder={t('platformManagement.people.loginControl.searchPlaceholder')}
            value={form.query}
            onChange={(query) => {
              const selected = options.find((option) => option.value === query);
              setForm((current) => ({
                ...current,
                query: selected ? selected.label : query,
                userId: selected?.value || '',
              }));
            }}
          />
          <Input
            allowClear
            maxLength={200}
            placeholder={t('platformManagement.people.loginControl.reasonPlaceholder')}
            value={form.reason}
            onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
          />
          <Button
            danger
            icon={<Icon icon={UserXIcon} />}
            loading={saving}
            onClick={disableSelectedUser}
          >
            {t('platformManagement.people.loginControl.actions.disable')}
          </Button>
        </div>
        <Table
          className={styles.table}
          columns={columns}
          dataSource={disabledUsers}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          rowKey={'id'}
          scroll={{ x: 900 }}
          size={'middle'}
          locale={{
            emptyText: <Empty description={t('platformManagement.people.loginControl.empty')} />,
          }}
        />
      </Block>
    );
  },
);

UserLoginStatusSettings.displayName = 'UserLoginStatusSettings';

export default UserLoginStatusSettings;
