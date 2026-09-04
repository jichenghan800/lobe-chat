'use client';

import { Block, Empty, Flexbox, Icon, Input, Skeleton, Tag, Text } from '@lobehub/ui';
import { Button, confirmModal, Segmented, Switch, toast } from '@lobehub/ui/base-ui';
import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PencilIcon, SaveIcon, Trash2Icon, UserPlusIcon, XIcon } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncError from '@/components/AsyncError';
import { isLoginAccessModeSelectable } from '@/features/CottiPlatformManagement/peopleManagementSafety';
import { sharedStyles } from '@/features/CottiPlatformManagement/sharedStyle';
import { useClientDataSWR } from '@/libs/swr';
import { cottiPeopleManagementService } from '@/services/cottiPeopleManagement';
import type { CottiAiAccessMember, CottiLoginAccessRule } from '@/types/cotti/peopleManagement';

import { styles } from './style';
import UserLoginStatusSettings from './UserLoginStatusSettings';

type LoginDomain = 'cotti.ai' | 'cotticoffee.com';

type LoginAccessListItem =
  | { id: string; loginDomain: 'cotti.ai'; member: CottiAiAccessMember }
  | { id: string; loginDomain: 'cotticoffee.com'; rule: CottiLoginAccessRule };

const LoginAccessSettings = memo(() => {
  const { t } = useTranslation('setting');
  const [loginDomain, setLoginDomain] = useState<LoginDomain>('cotticoffee.com');
  const [ruleType, setRuleType] = useState<'domain' | 'email'>('email');
  const [value, setValue] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [editingMemberId, setEditingMemberId] = useState<string>();
  const [pendingId, setPendingId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const detailSWR = useClientDataSWR(
    ['cotti', 'people-management', 'detail'],
    () => cottiPeopleManagementService.getDetail(),
    { revalidateOnFocus: false },
  );
  const loginAccess = detailSWR.data?.loginAccess;
  const cottiAiAccessManagementEnabled = detailSWR.data?.cottiAiAccessManagementEnabled === true;
  const cottiAiAccessMembers = detailSWR.data?.cottiAiAccessMembers;

  const resetCottiAiForm = useCallback(() => {
    setDisplayName('');
    setEmail('');
    setPhone('');
    setNote('');
    setEditingMemberId(undefined);
  }, []);

  const handleSaveRule = async () => {
    if (loginDomain === 'cotti.ai') {
      if (!displayName.trim() || (!email.trim() && !phone.trim())) {
        toast.warning(t('platformManagement.people.cottiAi.feedback.identityRequired'));
        return;
      }

      setSaving(true);
      try {
        const member = {
          displayName: displayName.trim(),
          email: email.trim() || undefined,
          note: note.trim() || undefined,
          phone: phone.trim() || undefined,
        };
        if (editingMemberId) {
          await cottiPeopleManagementService.updateCottiAiAccessMember(editingMemberId, member);
        } else {
          await cottiPeopleManagementService.upsertCottiAiAccessMember(member);
        }
        resetCottiAiForm();
        await detailSWR.mutate();
        toast.success(
          t(
            editingMemberId
              ? 'platformManagement.people.cottiAi.feedback.edited'
              : 'platformManagement.people.cottiAi.feedback.saved',
          ),
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t('platformManagement.people.feedback.saveFailed'),
        );
      } finally {
        setSaving(false);
      }
      return;
    }

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

  const handleToggleCottiAi = useCallback(
    async (id: string, enabled: boolean) => {
      setPendingId(id);
      try {
        await cottiPeopleManagementService.setCottiAiAccessMemberEnabled(id, enabled);
        await detailSWR.mutate();
        toast.success(t('platformManagement.people.cottiAi.feedback.updated'));
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
    [detailSWR, t],
  );

  const handleEditCottiAi = useCallback((member: CottiAiAccessMember) => {
    setLoginDomain('cotti.ai');
    setEditingMemberId(member.id);
    setDisplayName(member.displayName);
    setEmail(member.email || '');
    setPhone(member.phoneE164 || '');
    setNote(member.note || '');
  }, []);

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
    (record: LoginAccessListItem) => {
      confirmModal({
        content: t(
          record.loginDomain === 'cotti.ai'
            ? 'platformManagement.people.cottiAi.deleteConfirm'
            : 'platformManagement.people.login.deleteConfirm',
        ),
        okButtonProps: { danger: true },
        okText: t('platformManagement.people.actions.delete'),
        onOk: async () => {
          setPendingId(record.id);
          try {
            if (record.loginDomain === 'cotti.ai') {
              await cottiPeopleManagementService.removeCottiAiAccessMember(record.id);
            } else {
              await cottiPeopleManagementService.removeLoginRule(record.id);
            }
            await detailSWR.mutate();
            toast.success(
              t(
                record.loginDomain === 'cotti.ai'
                  ? 'platformManagement.people.cottiAi.feedback.removed'
                  : 'platformManagement.people.login.feedback.removed',
              ),
            );
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

  const dataSource = useMemo<LoginAccessListItem[]>(
    () => [
      ...(loginAccess?.rules || []).map((rule): LoginAccessListItem => ({
        id: rule.id,
        loginDomain: 'cotticoffee.com',
        rule,
      })),
      ...(cottiAiAccessManagementEnabled ? cottiAiAccessMembers || [] : []).map(
        (member): LoginAccessListItem => ({
          id: member.id,
          loginDomain: 'cotti.ai',
          member,
        }),
      ),
    ],
    [cottiAiAccessManagementEnabled, cottiAiAccessMembers, loginAccess?.rules],
  );

  const columns = useMemo<ColumnsType<LoginAccessListItem>>(
    () => [
      {
        render: (_, record) => (
          <Flexbox gap={2} style={{ minWidth: 0 }}>
            <Text ellipsis weight={500}>
              {record.loginDomain === 'cotti.ai'
                ? record.member.displayName
                : record.rule.user?.fullName || record.rule.user?.username || record.rule.value}
            </Text>
            {record.loginDomain === 'cotti.ai' ? (
              <Text ellipsis className={sharedStyles.copy} fontSize={12}>
                {[record.member.phoneE164, record.member.email].filter(Boolean).join(' / ')}
              </Text>
            ) : (
              record.rule.user && (
                <Text ellipsis className={sharedStyles.copy} fontSize={12}>
                  {record.rule.user.normalizedEmail || record.rule.user.email || record.rule.value}
                </Text>
              )
            )}
          </Flexbox>
        ),
        title: t('platformManagement.people.login.columns.person'),
        width: '28%',
      },
      ...(cottiAiAccessManagementEnabled
        ? [
            {
              render: (_: unknown, record: LoginAccessListItem) => <Tag>{record.loginDomain}</Tag>,
              title: t('platformManagement.people.login.columns.loginDomain'),
              width: 150,
            },
          ]
        : []),
      {
        render: (_, record) =>
          record.loginDomain === 'cotti.ai' ? (
            <Flexbox horizontal align={'center'} gap={8}>
              <Switch
                checked={record.member.enabled}
                disabled={pendingId === record.id}
                onChange={(checked) => void handleToggleCottiAi(record.id, checked)}
              />
              <Tag color={record.member.authUserId ? 'success' : 'default'}>
                {t(
                  record.member.authUserId
                    ? 'platformManagement.people.cottiAi.status.ready'
                    : 'platformManagement.people.cottiAi.status.pending',
                )}
              </Tag>
            </Flexbox>
          ) : (
            <Flexbox horizontal gap={4} wrap={'wrap'}>
              <Tag>{t(`platformManagement.people.login.ruleType.${record.rule.type}`)}</Tag>
              <Tag color={record.rule.user ? 'success' : 'default'}>
                {record.rule.type === 'domain'
                  ? t('platformManagement.people.login.status.domain')
                  : record.rule.user
                    ? t('platformManagement.people.login.status.registered')
                    : t('platformManagement.people.login.status.pending')}
              </Tag>
            </Flexbox>
          ),
        title: t('platformManagement.people.login.columns.status'),
        width: 210,
      },
      {
        render: (_, record) =>
          (record.loginDomain === 'cotti.ai' ? record.member.note : record.rule.note) || '-',
        title: t('platformManagement.people.login.columns.note'),
      },
      {
        render: (_, record) => (
          <Tag>
            {t(
              `platformManagement.people.source.${
                record.loginDomain === 'cotti.ai' ? 'database' : record.rule.source
              }`,
            )}
          </Tag>
        ),
        title: t('platformManagement.people.login.columns.source'),
        width: 120,
      },
      {
        render: (_, record) => (
          <Flexbox horizontal gap={8}>
            {record.loginDomain === 'cotti.ai' && (
              <Button
                disabled={pendingId === record.id}
                icon={<Icon icon={PencilIcon} />}
                size={'small'}
                title={t('platformManagement.people.actions.edit')}
                onClick={() => handleEditCottiAi(record.member)}
              />
            )}
            <Button
              danger
              icon={<Icon icon={Trash2Icon} />}
              loading={pendingId === record.id}
              size={'small'}
              title={t('platformManagement.people.actions.delete')}
              onClick={() => handleRemove(record)}
            />
          </Flexbox>
        ),
        title: t('platformManagement.people.login.columns.actions'),
        width: 110,
      },
    ],
    [
      cottiAiAccessManagementEnabled,
      handleEditCottiAi,
      handleRemove,
      handleToggleCottiAi,
      pendingId,
      t,
    ],
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
  if (!loginAccess || !cottiAiAccessMembers)
    return <Skeleton active paragraph={{ rows: 8 }} title={false} />;

  return (
    <Flexbox gap={16}>
      <Block className={sharedStyles.card} gap={12} padding={20} variant={'outlined'}>
        <Flexbox className={sharedStyles.sectionHeader} gap={4}>
          <Text className={sharedStyles.sectionTitle}>
            {t(
              cottiAiAccessManagementEnabled
                ? 'platformManagement.people.login.mode.titleWithCottiAi'
                : 'platformManagement.people.login.mode.title',
            )}
          </Text>
          <Text className={sharedStyles.copy} fontSize={12}>
            {t(
              cottiAiAccessManagementEnabled
                ? 'platformManagement.people.login.mode.descWithCottiAi'
                : 'platformManagement.people.login.mode.desc',
            )}
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

      <Block className={sharedStyles.card} gap={16} padding={20} variant={'outlined'}>
        <Flexbox className={sharedStyles.sectionHeader} gap={4}>
          <Text className={sharedStyles.sectionTitle}>
            {t(
              cottiAiAccessManagementEnabled
                ? 'platformManagement.people.login.list.titleWithCottiAi'
                : 'platformManagement.people.login.list.title',
            )}
          </Text>
          <Text className={sharedStyles.copy} fontSize={12}>
            {t(
              cottiAiAccessManagementEnabled
                ? 'platformManagement.people.login.list.descWithCottiAi'
                : 'platformManagement.people.login.list.desc',
            )}
          </Text>
        </Flexbox>
        <div className={loginDomain === 'cotti.ai' ? styles.cottiAiFormGrid : styles.formGrid}>
          {cottiAiAccessManagementEnabled && (
            <Segmented
              value={loginDomain}
              options={(['cotticoffee.com', 'cotti.ai'] as const).map((domain) => ({
                label: domain,
                value: domain,
              }))}
              onChange={(domain) => {
                const nextDomain = domain as LoginDomain;
                if (nextDomain !== 'cotti.ai') resetCottiAiForm();
                setLoginDomain(nextDomain);
              }}
            />
          )}
          {loginDomain === 'cotticoffee.com' ? (
            <>
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
            </>
          ) : (
            <>
              <Input
                allowClear
                placeholder={t('platformManagement.people.cottiAi.placeholder.name')}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
              <Input
                allowClear
                placeholder={t('platformManagement.people.cottiAi.placeholder.phone')}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
              <Input
                allowClear
                placeholder={t('platformManagement.people.cottiAi.placeholder.email')}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onPressEnter={() => void handleSaveRule()}
              />
            </>
          )}
          <Input
            allowClear
            maxLength={200}
            placeholder={t('platformManagement.people.login.notePlaceholder')}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onPressEnter={() => void handleSaveRule()}
          />
          <Flexbox horizontal gap={8}>
            <Button
              icon={<Icon icon={editingMemberId ? SaveIcon : UserPlusIcon} />}
              loading={saving}
              type={'primary'}
              onClick={() => void handleSaveRule()}
            >
              {t(
                editingMemberId
                  ? 'platformManagement.people.actions.saveChanges'
                  : 'platformManagement.people.login.actions.add',
              )}
            </Button>
            {editingMemberId && (
              <Button disabled={saving} icon={<Icon icon={XIcon} />} onClick={resetCottiAiForm}>
                {t('platformManagement.people.actions.cancel')}
              </Button>
            )}
          </Flexbox>
        </div>
        <Table
          className={styles.table}
          columns={columns}
          dataSource={dataSource}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          rowKey={'id'}
          scroll={{ x: 900 }}
          size={'middle'}
          locale={{
            emptyText: <Empty description={t('platformManagement.people.login.empty')} />,
          }}
        />
      </Block>

      <UserLoginStatusSettings
        disabledUsers={detailSWR.data?.disabledLoginUsers || []}
        onChanged={detailSWR.mutate}
      />
    </Flexbox>
  );
});

LoginAccessSettings.displayName = 'LoginAccessSettings';

export default LoginAccessSettings;
