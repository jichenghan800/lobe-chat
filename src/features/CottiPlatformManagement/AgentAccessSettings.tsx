'use client';

import { Block, Empty, Flexbox, Icon, Skeleton, Tag, Text } from '@lobehub/ui';
import { Button, confirmModal, Segmented, Switch, toast } from '@lobehub/ui/base-ui';
import { useDebounce } from 'ahooks';
import { AutoComplete, Input, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { createStaticStyles, cssVar, responsive } from 'antd-style';
import { ShieldCheckIcon, Trash2Icon, UserPlusIcon } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncError from '@/components/AsyncError';
import { useClientDataSWR } from '@/libs/swr';
import { cottiAgentAccessService } from '@/services/cottiAgentAccess';
import type {
  CottiAgentAccessMode,
  CottiAgentAccessRule,
  CottiAgentAccessRuleType,
  CottiAgentAccessUserSuggestion,
} from '@/types/cotti/agentAccess';

import { getAgentAccessRuleMemberPresentation } from './agentAccessPresentation';
import { sharedStyles } from './sharedStyle';

const USER_SEARCH_MIN_LENGTH = 2;

const styles = createStaticStyles(({ css }) => ({
  inlineForm: css`
    display: grid;
    grid-template-columns: 148px minmax(220px, 1fr) minmax(160px, 0.7fr) auto;
    gap: 12px;
    width: 100%;

    ${responsive.md} {
      grid-template-columns: 1fr;
    }
  `,
  modeSummary: css`
    padding-block: 12px;
    padding-inline: 14px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};

    background: ${cssVar.colorFillQuaternary};
  `,
  table: css`
    :where(.ant-table-cell) {
      word-break: break-word;
      white-space: normal;
    }
  `,
}));

const AgentAccessSettings = memo(() => {
  const { i18n, t } = useTranslation('setting');
  const [ruleType, setRuleType] = useState<CottiAgentAccessRuleType>('email');
  const [ruleValue, setRuleValue] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModeSaving, setIsModeSaving] = useState(false);
  const [pendingRuleId, setPendingRuleId] = useState<string>();
  const debouncedRuleValue = useDebounce(ruleValue, { wait: 300 });

  const detailSWR = useClientDataSWR(
    ['cotti', 'agent-access', 'detail'],
    () => cottiAgentAccessService.getDetail(),
    { revalidateOnFocus: false },
  );
  const userSearchQuery = debouncedRuleValue.trim();
  const shouldSearchUsers = userSearchQuery.length >= USER_SEARCH_MIN_LENGTH;
  const userSearchSWR = useClientDataSWR<CottiAgentAccessUserSuggestion[]>(
    shouldSearchUsers ? ['cotti', 'agent-access', 'user-search', userSearchQuery] : null,
    () => cottiAgentAccessService.searchUsers(userSearchQuery),
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );

  const mode = detailSWR.data?.mode ?? 'allowlist';
  const userSuggestionOptions = useMemo(
    () =>
      (userSearchSWR.data || []).flatMap((user) => {
        const email = user.email || user.normalizedEmail;
        const value = ruleType === 'email' ? email : user.id;
        if (!value) return [];

        return [
          {
            label: `${user.fullName || user.username || email || user.id} · ${email || user.id}`,
            value,
          },
        ];
      }),
    [ruleType, userSearchSWR.data],
  );

  const handleSetMode = async (nextMode: CottiAgentAccessMode) => {
    if (nextMode === mode) return;

    setIsModeSaving(true);
    try {
      await cottiAgentAccessService.setMode(nextMode);
      await detailSWR.mutate();
      toast.success(t('platformManagement.agentAccess.feedback.modeSaved'));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('platformManagement.agentAccess.feedback.saveFailed'),
      );
    } finally {
      setIsModeSaving(false);
    }
  };

  const handleSubmitRule = async () => {
    const value = ruleValue.trim();
    if (!value) {
      toast.warning(t('platformManagement.agentAccess.feedback.valueRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      await cottiAgentAccessService.upsertRule({
        note: note.trim() || undefined,
        type: ruleType,
        value,
      });
      setRuleValue('');
      setNote('');
      await detailSWR.mutate();
      toast.success(t('platformManagement.agentAccess.feedback.ruleSaved'));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('platformManagement.agentAccess.feedback.saveFailed'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleRule = useCallback(
    async (id: string, enabled: boolean) => {
      setPendingRuleId(id);
      try {
        await cottiAgentAccessService.setRuleEnabled(id, enabled);
        await detailSWR.mutate();
        toast.success(t('platformManagement.agentAccess.feedback.ruleSaved'));
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t('platformManagement.agentAccess.feedback.saveFailed'),
        );
      } finally {
        setPendingRuleId(undefined);
      }
    },
    [detailSWR, t],
  );

  const handleRemoveRule = useCallback(
    (id: string) => {
      confirmModal({
        okButtonProps: { danger: true },
        okText: t('platformManagement.agentAccess.actions.delete'),
        onOk: async () => {
          setPendingRuleId(id);
          try {
            await cottiAgentAccessService.removeRule(id);
            await detailSWR.mutate();
            toast.success(t('platformManagement.agentAccess.feedback.ruleRemoved'));
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : t('platformManagement.agentAccess.feedback.saveFailed'),
            );
          } finally {
            setPendingRuleId(undefined);
          }
        },
        title: t('platformManagement.agentAccess.deleteConfirm'),
      });
    },
    [detailSWR, t],
  );

  const columns = useMemo<ColumnsType<CottiAgentAccessRule>>(
    () => [
      {
        render: (_, record) => (
          <Tag>{t(`platformManagement.agentAccess.ruleType.${record.type}`)}</Tag>
        ),
        title: t('platformManagement.agentAccess.columns.type'),
        width: 100,
      },
      {
        dataIndex: 'value',
        render: (_value: string, record) => {
          const member = getAgentAccessRuleMemberPresentation(record);

          return (
            <Flexbox gap={0} style={{ minWidth: 0 }}>
              <Text ellipsis weight={500}>
                {member.title}
              </Text>
              {member.subtitle && (
                <Text ellipsis className={sharedStyles.copy} fontSize={12}>
                  {member.subtitle}
                </Text>
              )}
            </Flexbox>
          );
        },
        title: t('platformManagement.agentAccess.columns.member'),
        width: '36%',
      },
      {
        dataIndex: 'note',
        render: (value?: null | string) => value || '-',
        title: t('platformManagement.agentAccess.columns.note'),
      },
      {
        dataIndex: 'enabled',
        render: (enabled: boolean, record) => (
          <Switch
            checked={enabled}
            disabled={pendingRuleId === record.id}
            onChange={(checked) => void handleToggleRule(record.id, checked)}
          />
        ),
        title: t('platformManagement.agentAccess.columns.enabled'),
        width: 92,
      },
      {
        dataIndex: 'createdAt',
        render: (value: Date | string) =>
          new Intl.DateTimeFormat(i18n.language, {
            dateStyle: 'short',
            timeStyle: 'short',
          }).format(new Date(value)),
        title: t('platformManagement.agentAccess.columns.createdAt'),
        width: 160,
      },
      {
        render: (_, record) => (
          <Button
            danger
            icon={<Icon icon={Trash2Icon} />}
            loading={pendingRuleId === record.id}
            size={'small'}
            onClick={() => handleRemoveRule(record.id)}
          />
        ),
        title: t('platformManagement.agentAccess.columns.actions'),
        width: 72,
      },
    ],
    [handleRemoveRule, handleToggleRule, i18n.language, pendingRuleId, t],
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

  if (!detailSWR.data) return <Skeleton active paragraph={{ rows: 8 }} title={false} />;

  return (
    <Flexbox gap={16}>
      <Block className={sharedStyles.card} gap={16} padding={20} variant={'outlined'}>
        <Flexbox className={sharedStyles.sectionHeader} gap={4}>
          <Text className={sharedStyles.sectionTitle}>
            {t('platformManagement.agentAccess.mode.title')}
          </Text>
          <Text className={sharedStyles.copy} fontSize={13}>
            {t('platformManagement.agentAccess.mode.desc')}
          </Text>
        </Flexbox>
        <Flexbox className={styles.modeSummary} gap={6}>
          <Flexbox horizontal align={'center'} gap={8}>
            <Icon icon={ShieldCheckIcon} />
            <Text weight={600}>{t(`platformManagement.agentAccess.mode.${mode}.title`)}</Text>
            <Tag>{t(`platformManagement.agentAccess.source.${detailSWR.data.source}`)}</Tag>
          </Flexbox>
          <Text className={sharedStyles.copy} fontSize={13}>
            {t(`platformManagement.agentAccess.mode.${mode}.desc`)}
          </Text>
        </Flexbox>
        <Segmented
          disabled={isModeSaving}
          value={mode}
          options={(['allowlist', 'open', 'off'] as const).map((value) => ({
            label: t(`platformManagement.agentAccess.mode.${value}.label`),
            value,
          }))}
          onChange={(value) => void handleSetMode(value as CottiAgentAccessMode)}
        />
      </Block>

      <Block className={sharedStyles.card} gap={16} padding={20} variant={'outlined'}>
        <Flexbox className={sharedStyles.sectionHeader} gap={4}>
          <Text className={sharedStyles.sectionTitle}>
            {t('platformManagement.agentAccess.allowlist.title')}
          </Text>
          <Text className={sharedStyles.copy} fontSize={13}>
            {t('platformManagement.agentAccess.allowlist.desc')}
          </Text>
        </Flexbox>
        <div className={styles.inlineForm}>
          <Segmented
            value={ruleType}
            options={(['email', 'userId'] as const).map((value) => ({
              label: t(`platformManagement.agentAccess.ruleType.${value}`),
              value,
            }))}
            onChange={(value) => setRuleType(value as CottiAgentAccessRuleType)}
          />
          <AutoComplete
            allowClear
            options={userSuggestionOptions}
            placeholder={t(`platformManagement.agentAccess.search.${ruleType}`)}
            value={ruleValue}
            notFoundContent={
              shouldSearchUsers && !userSearchSWR.isLoading
                ? t('platformManagement.agentAccess.search.noResults')
                : undefined
            }
            onChange={setRuleValue}
            onSelect={setRuleValue}
          >
            <Input onPressEnter={() => void handleSubmitRule()} />
          </AutoComplete>
          <Input
            allowClear
            maxLength={200}
            placeholder={t('platformManagement.agentAccess.notePlaceholder')}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onPressEnter={() => void handleSubmitRule()}
          />
          <Button
            icon={<Icon icon={UserPlusIcon} />}
            loading={isSubmitting}
            type={'primary'}
            onClick={() => void handleSubmitRule()}
          >
            {t('platformManagement.agentAccess.actions.add')}
          </Button>
        </div>
        <Table
          className={styles.table}
          columns={columns}
          dataSource={detailSWR.data.rules}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          rowKey={'id'}
          scroll={{ x: 760 }}
          size={'middle'}
          locale={{
            emptyText: <Empty description={t('platformManagement.agentAccess.empty')} />,
          }}
        />
      </Block>
    </Flexbox>
  );
});

AgentAccessSettings.displayName = 'AgentAccessSettings';

export default AgentAccessSettings;
