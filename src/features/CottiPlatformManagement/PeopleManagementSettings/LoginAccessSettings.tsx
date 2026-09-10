'use client';

import { Block, Empty, Flexbox, Icon, Input } from '@lobehub/ui';
import { Button, confirmModal, Segmented, Skeleton, Tag, Text, toast } from '@lobehub/ui/base-ui';
import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Trash2Icon, UserPlusIcon } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncError from '@/components/AsyncError';
import { isLoginAccessModeSelectable } from '@/features/CottiPlatformManagement/peopleManagementSafety';
import { sharedStyles } from '@/features/CottiPlatformManagement/sharedStyle';
import { useClientDataSWR } from '@/libs/swr';
import { cottiPeopleManagementService } from '@/services/cottiPeopleManagement';
import type { CottiLoginAccessRule } from '@/types/cotti/peopleManagement';

import { styles } from './style';
import UserLoginStatusSettings from './UserLoginStatusSettings';

const LoginAccessSettings = memo(() => {
  const { t } = useTranslation('setting');
  const [ruleType, setRuleType] = useState<'domain' | 'email'>('email');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [pendingId, setPendingId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const detailSWR = useClientDataSWR(
    ['cotti', 'people-management', 'detail'],
    () => cottiPeopleManagementService.getDetail(),
    { revalidateOnFocus: false },
  );
  const loginAccess = detailSWR.data?.loginAccess;

  const handleSaveRule = async () => {
    const normalizedValue = value.trim();
    if (!normalizedValue) {
      toast.warning(t('platformManagement.people.login.feedback.valueRequired'));
      return;
    }

    setSaving(true);
    try {
      await cottiPeopleManagementService.upsertLoginRule({
        note: note.trim() || undefined,
        type: ruleType,
        value: normalizedValue,
      });
      setValue('');
      setNote('');
      await detailSWR.mutate();
      toast.success(t('platformManagement.people.login.feedback.saved'));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('platformManagement.people.feedback.saveFailed'),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSetMode = async (mode: 'allowlist' | 'open') => {
    if (!loginAccess || mode === loginAccess.mode || !isLoginAccessModeSelectable(mode)) return;

    setSaving(true);
    try {
      await cottiPeopleManagementService.setLoginMode(mode);
      await detailSWR.mutate();
      toast.success(t('platformManagement.people.login.feedback.modeSaved'));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('platformManagement.people.feedback.saveFailed'),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = useCallback(
    (record: CottiLoginAccessRule) => {
      confirmModal({
        content: t('platformManagement.people.login.deleteConfirm'),
        okButtonProps: { danger: true },
        okText: t('platformManagement.people.actions.delete'),
        onOk: async () => {
          setPendingId(record.id);
          try {
            await cottiPeopleManagementService.removeLoginRule(record.id);
            await detailSWR.mutate();
            toast.success(t('platformManagement.people.login.feedback.removed'));
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

  const columns = useMemo<ColumnsType<CottiLoginAccessRule>>(
    () => [
      {
        render: (_, record) => (
          <Flexbox gap={2} style={{ minWidth: 0 }}>
            <Text ellipsis weight={500}>
              {record.user?.fullName || record.user?.username || record.value}
            </Text>
            {record.user && (
              <Text ellipsis className={sharedStyles.copy} fontSize={12}>
                {record.user.normalizedEmail || record.user.email || record.value}
              </Text>
            )}
          </Flexbox>
        ),
        title: t('platformManagement.people.login.columns.person'),
        width: '34%',
      },
      {
        render: (_, record) => (
          <Flexbox horizontal gap={4} wrap={'wrap'}>
            <Tag>{t(`platformManagement.people.login.ruleType.${record.type}`)}</Tag>
            <Tag color={record.user ? 'success' : 'default'}>
              {record.type === 'domain'
                ? t('platformManagement.people.login.status.domain')
                : record.user
                  ? t('platformManagement.people.login.status.registered')
                  : t('platformManagement.people.login.status.pending')}
            </Tag>
          </Flexbox>
        ),
        title: t('platformManagement.people.login.columns.status'),
        width: 190,
      },
      {
        dataIndex: 'note',
        render: (text?: null | string) => text || '-',
        title: t('platformManagement.people.login.columns.note'),
      },
      {
        render: (_, record) => <Tag>{t(`platformManagement.people.source.${record.source}`)}</Tag>,
        title: t('platformManagement.people.login.columns.source'),
        width: 120,
      },
      {
        render: (_, record) => (
          <Button
            danger
            icon={<Icon icon={Trash2Icon} />}
            loading={pendingId === record.id}
            size={'small'}
            onClick={() => handleRemove(record)}
          />
        ),
        title: t('platformManagement.people.login.columns.actions'),
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
  if (!loginAccess) return <Skeleton height={240} />;

  return (
    <Flexbox gap={16}>
      <Block className={sharedStyles.card} gap={12} padding={20} variant={'outlined'}>
        <Flexbox className={sharedStyles.sectionHeader} gap={4}>
          <Text className={sharedStyles.sectionTitle}>
            {t('platformManagement.people.login.mode.title')}
          </Text>
          <Text className={sharedStyles.copy} fontSize={12}>
            {t('platformManagement.people.login.mode.desc')}
          </Text>
        </Flexbox>
        <Segmented
          disabled={saving}
          value={loginAccess.mode}
          options={(['allowlist', 'open'] as const).map((mode) => ({
            disabled: !isLoginAccessModeSelectable(mode),
            label: t(`platformManagement.people.login.mode.${mode}.label`),
            title:
              mode === 'open'
                ? t('platformManagement.people.login.mode.open.disabledHint')
                : undefined,
            value: mode,
          }))}
          onChange={(mode) => void handleSetMode(mode as 'allowlist' | 'open')}
        />
        <Text className={sharedStyles.copy} fontSize={12}>
          {t(`platformManagement.people.login.mode.${loginAccess.mode}.desc`)}
        </Text>
      </Block>

      {loginAccess.mode === 'allowlist' && (
        <Block className={sharedStyles.card} gap={16} padding={20} variant={'outlined'}>
          <Flexbox className={sharedStyles.sectionHeader} gap={4}>
            <Text className={sharedStyles.sectionTitle}>
              {t('platformManagement.people.login.list.title')}
            </Text>
            <Text className={sharedStyles.copy} fontSize={12}>
              {t('platformManagement.people.login.list.desc')}
            </Text>
          </Flexbox>
          <div className={styles.formGrid}>
            <Segmented
              value={ruleType}
              options={(['email', 'domain'] as const).map((type) => ({
                label: t(`platformManagement.people.login.ruleType.${type}`),
                value: type,
              }))}
              onChange={(type) => setRuleType(type as 'domain' | 'email')}
            />
            <Input
              allowClear
              placeholder={t(`platformManagement.people.login.placeholder.${ruleType}`)}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onPressEnter={() => void handleSaveRule()}
            />
            <Input
              allowClear
              maxLength={200}
              placeholder={t('platformManagement.people.login.notePlaceholder')}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              onPressEnter={() => void handleSaveRule()}
            />
            <Button
              icon={<Icon icon={UserPlusIcon} />}
              loading={saving}
              type={'primary'}
              onClick={() => void handleSaveRule()}
            >
              {t('platformManagement.people.login.actions.add')}
            </Button>
          </div>
          <Table
            className={styles.table}
            columns={columns}
            dataSource={loginAccess.rules}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            rowKey={'id'}
            scroll={{ x: 900 }}
            size={'middle'}
            locale={{
              emptyText: <Empty description={t('platformManagement.people.login.empty')} />,
            }}
          />
        </Block>
      )}

      <UserLoginStatusSettings
        disabledUsers={detailSWR.data?.disabledLoginUsers || []}
        onChanged={detailSWR.mutate}
      />
    </Flexbox>
  );
});

LoginAccessSettings.displayName = 'LoginAccessSettings';

export default LoginAccessSettings;
