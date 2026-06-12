'use client';

import { Flexbox, FormGroup, Icon, Segmented, Text } from '@lobehub/ui';
import { App, Button, Empty, Input, Popconfirm, Skeleton, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { createStaticStyles } from 'antd-style';
import { LockKeyhole, ShieldCheck, UserPlus, UsersRound } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';

import { useClientDataSWR } from '@/libs/swr';
import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';
import { agentAccessService } from '@/services/agentAccess';
import type { AgentAccessMode, AgentAccessRuleType } from '@/types/agentAccess';

const styles = createStaticStyles(({ css, cssVar }) => ({
  inlineForm: css`
    display: grid;
    grid-template-columns: 160px minmax(220px, 1fr) minmax(160px, 0.7fr) auto;
    gap: 12px;
    width: 100%;

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  `,
  muted: css`
    color: ${cssVar.colorTextDescription};
  `,
  panel: css`
    padding: 16px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;
    background: ${cssVar.colorBgContainer};
  `,
  panelIcon: css`
    display: grid;
    place-items: center;

    flex: none;
    width: 32px;
    height: 32px;
    border-radius: 8px;

    color: ${cssVar.colorPrimary};
    background: ${cssVar.colorFillQuaternary};
  `,
  table: css`
    :where(.ant-table) {
      overflow: hidden;
    }

    :where(.ant-table-cell) {
      white-space: normal;
      word-break: break-word;
    }
  `,
  toolbar: css`
    width: fit-content;
  `,
}));

const modeOptions = [
  { label: '白名单', value: 'allowlist' },
  { label: '全员开放', value: 'open' },
  { label: '全部关闭', value: 'off' },
] satisfies Array<{ label: string; value: AgentAccessMode }>;

const typeOptions = [
  { label: '邮箱', value: 'email' },
  { label: '用户 ID', value: 'userId' },
] satisfies Array<{ label: string; value: AgentAccessRuleType }>;

const modeCopy: Record<AgentAccessMode, { color: string; desc: string; title: string }> = {
  allowlist: {
    color: 'processing',
    desc: '仅白名单中启用的邮箱或用户 ID 可以使用 Agent Mode、自动任务和沙箱工具。',
    title: '白名单控制',
  },
  off: {
    color: 'default',
    desc: '所有用户都不能使用 Agent 相关能力，普通对话不受影响。',
    title: '全部关闭',
  },
  open: {
    color: 'success',
    desc: '所有登录用户都可以使用 Agent 相关能力。',
    title: '全员开放',
  },
};

const formatDateTime = (value?: Date | string | null) => {
  if (!value) return '-';

  return new Date(value).toLocaleString('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  });
};

const AgentAccessSettings = memo(() => {
  const { message } = App.useApp();
  const [ruleType, setRuleType] = useState<AgentAccessRuleType>('email');
  const [ruleValue, setRuleValue] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingRuleId, setPendingRuleId] = useState<string>();
  const [isModeSaving, setIsModeSaving] = useState(false);

  const { data, error, isLoading, mutate } = useClientDataSWR('agent-access-settings', () =>
    agentAccessService.getDetail(),
  );

  useEffect(() => {
    if (!error) return;

    void message.error('Agent 权限配置加载失败，请确认当前账号有管理员权限');
  }, [error, message]);

  const mode = data?.mode ?? 'allowlist';
  const currentModeCopy = modeCopy[mode];

  const handleSetMode = async (nextMode: AgentAccessMode) => {
    if (nextMode === mode) return;

    setIsModeSaving(true);
    try {
      await agentAccessService.setMode(nextMode);
      await mutate();
      void message.success('访问模式已更新');
    } catch (error) {
      void message.error(error instanceof Error ? error.message : '访问模式更新失败');
    } finally {
      setIsModeSaving(false);
    }
  };

  const handleSubmitRule = async () => {
    const value = ruleValue.trim();
    if (!value) {
      void message.warning('请输入邮箱或用户 ID');
      return;
    }

    setIsSubmitting(true);
    try {
      await agentAccessService.upsertRule({
        note: note.trim() || undefined,
        type: ruleType,
        value,
      });
      setRuleValue('');
      setNote('');
      await mutate();
      void message.success('白名单已更新');
    } catch (error) {
      void message.error(error instanceof Error ? error.message : '白名单更新失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleRule = async (id: string, enabled: boolean) => {
    setPendingRuleId(id);
    try {
      await agentAccessService.setRuleEnabled(id, enabled);
      await mutate();
      void message.success(enabled ? '白名单项已启用' : '白名单项已停用');
    } catch (error) {
      void message.error(error instanceof Error ? error.message : '白名单项更新失败');
    } finally {
      setPendingRuleId(undefined);
    }
  };

  const handleRemoveRule = async (id: string) => {
    setPendingRuleId(id);
    try {
      await agentAccessService.removeRule(id);
      await mutate();
      void message.success('白名单项已删除');
    } catch (error) {
      void message.error(error instanceof Error ? error.message : '白名单项删除失败');
    } finally {
      setPendingRuleId(undefined);
    }
  };

  const columns = useMemo<ColumnsType<NonNullable<typeof data>['rules'][number]>>(
    () => [
      {
        render: (_, record) => <Tag>{record.type === 'email' ? '邮箱' : '用户 ID'}</Tag>,
        title: '类型',
        width: 92,
      },
      {
        dataIndex: 'value',
        render: (value: string) => <Text ellipsis>{value}</Text>,
        title: '成员',
        width: '32%',
      },
      {
        dataIndex: 'note',
        render: (value?: string | null) => value || <Text className={styles.muted}>-</Text>,
        title: '备注',
        width: '24%',
      },
      {
        dataIndex: 'enabled',
        render: (enabled: boolean) =>
          enabled ? <Tag color="success">已启用</Tag> : <Tag>已停用</Tag>,
        title: '状态',
        width: 92,
      },
      {
        dataIndex: 'createdAt',
        render: formatDateTime,
        title: '创建时间',
        width: 132,
      },
      {
        render: (_, record) => (
          <Space size={8}>
            <Button
              loading={pendingRuleId === record.id}
              size="small"
              type="link"
              onClick={() => handleToggleRule(record.id, !record.enabled)}
            >
              {record.enabled ? '停用' : '启用'}
            </Button>
            <Popconfirm
              okText="删除"
              title="删除该白名单项？"
              onConfirm={() => handleRemoveRule(record.id)}
            >
              <Button danger loading={pendingRuleId === record.id} size="small" type="link">
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
        title: '操作',
        width: 128,
      },
    ],
    [pendingRuleId],
  );

  return (
    <>
      <SettingHeader title="Agent 权限配置" />
      <Flexbox gap={24}>
        <Text className={styles.muted} fontSize={13}>
          管理员可直接调整 Agent 功能访问范围，保存后立即生效，无需重启容器。
        </Text>
        <FormGroup desc="控制 Agent Mode、自动任务和沙箱工具的可见与可用范围。" title="访问模式">
          {isLoading ? (
            <Skeleton active paragraph={{ rows: 2 }} title={false} />
          ) : (
            <Flexbox gap={12}>
              <Flexbox horizontal align="center" className={styles.panel} gap={12}>
                <span className={styles.panelIcon}>
                  <Icon icon={ShieldCheck} size={17} />
                </span>
                <Flexbox gap={4}>
                  <Flexbox horizontal align="center" gap={8}>
                    <Text weight={600}>{currentModeCopy.title}</Text>
                    <Tag color={currentModeCopy.color}>
                      {data?.source === 'database' ? '数据库配置' : '环境变量兜底'}
                    </Tag>
                  </Flexbox>
                  <Text className={styles.muted} fontSize={13}>
                    {currentModeCopy.desc}
                  </Text>
                </Flexbox>
              </Flexbox>
              <Segmented
                className={styles.toolbar}
                disabled={isModeSaving}
                options={modeOptions}
                value={mode}
                onChange={(value) => handleSetMode(value as AgentAccessMode)}
              />
            </Flexbox>
          )}
        </FormGroup>

        <FormGroup
          desc="支持按邮箱或用户 ID 添加。邮箱会自动转为小写；重复添加会更新备注并重新启用。"
          title="白名单成员"
        >
          <Flexbox gap={16}>
            <div className={styles.inlineForm}>
              <Segmented
                options={typeOptions}
                value={ruleType}
                onChange={(value) => setRuleType(value as AgentAccessRuleType)}
              />
              <Input
                allowClear
                placeholder={ruleType === 'email' ? 'name@company.com' : '用户 ID'}
                value={ruleValue}
                onChange={(event) => setRuleValue(event.target.value)}
                onPressEnter={handleSubmitRule}
              />
              <Input
                allowClear
                placeholder="备注，可选"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                onPressEnter={handleSubmitRule}
              />
              <Button
                icon={<Icon icon={UserPlus} size={15} />}
                loading={isSubmitting}
                type="primary"
                onClick={handleSubmitRule}
              >
                添加
              </Button>
            </div>

            <Table
              className={styles.table}
              columns={columns}
              dataSource={data?.rules || []}
              loading={isLoading}
              locale={{
                emptyText: (
                  <Empty description="暂无白名单成员" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ),
              }}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              rowKey="id"
              size="middle"
            />
          </Flexbox>
        </FormGroup>

        <FormGroup title="生效范围">
          <Flexbox horizontal gap={12} wrap="wrap">
            <Flexbox className={styles.panel} flex={1} gap={8}>
              <Icon icon={UsersRound} size={18} />
              <Text weight={600}>实时生效</Text>
              <Text className={styles.muted} fontSize={13}>
                后端每次判断 Agent 入口和工具调用权限时读取数据库配置。
              </Text>
            </Flexbox>
            <Flexbox className={styles.panel} flex={1} gap={8}>
              <Icon icon={LockKeyhole} size={18} />
              <Text weight={600}>普通对话不受影响</Text>
              <Text className={styles.muted} fontSize={13}>
                关闭 Agent 仅影响 Agent Mode、自动任务和沙箱类能力。
              </Text>
            </Flexbox>
          </Flexbox>
        </FormGroup>
      </Flexbox>
    </>
  );
});

export default AgentAccessSettings;
