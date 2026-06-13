'use client';

import { Flexbox, FormGroup, Icon, Text } from '@lobehub/ui';
import { App, Button, Drawer, Empty, Input, Segmented, Select, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { createStaticStyles } from 'antd-style';
import {
  AlertTriangle,
  Bot,
  Download,
  Eye,
  MessageSquare,
  Search,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useClientDataSWR } from '@/libs/swr';
import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';
import { platformAuditService } from '@/services/platformAudit';
import type {
  PlatformAuditDetail,
  PlatformAuditFeatureType,
  PlatformAuditItem,
  PlatformAuditQuery,
  PlatformAuditRange,
  PlatformAuditRiskLevel,
} from '@/types/platformAudit';

const styles = createStaticStyles(({ css, cssVar }) => ({
  content: css`
    max-height: 48vh;
    overflow: auto;

    padding: 12px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;

    white-space: pre-wrap;
    word-break: break-word;

    background: ${cssVar.colorFillQuaternary};
  `,
  metric: css`
    min-width: 160px;
    padding: 14px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;
    background: ${cssVar.colorBgContainer};
  `,
  muted: css`
    color: ${cssVar.colorTextDescription};
  `,
  table: css`
    :where(.ant-table-cell) {
      white-space: normal;
      word-break: break-word;
    }
  `,
}));

const rangeOptions = [
  { label: '今天', value: 1 },
  { label: '7 天', value: 7 },
  { label: '30 天', value: 30 },
  { label: '90 天', value: 90 },
] satisfies Array<{ label: string; value: PlatformAuditRange }>;

const featureOptions = [
  { label: '全部', value: 'all' },
  { label: '普通对话', value: 'chat' },
  { label: 'Agent', value: 'agent' },
  { label: '工具', value: 'tool' },
  { label: '联网', value: 'search' },
  { label: '错误', value: 'error' },
] satisfies Array<{ label: string; value: PlatformAuditFeatureType | 'all' }>;

const riskOptions = [
  { label: '全部风险', value: 'all' },
  { label: '高风险', value: 'high' },
  { label: '中风险', value: 'medium' },
  { label: '低风险', value: 'low' },
  { label: '无风险', value: 'none' },
] satisfies Array<{ label: string; value: PlatformAuditRiskLevel | 'all' }>;

const riskColor: Record<PlatformAuditRiskLevel, string> = {
  high: 'error',
  low: 'default',
  medium: 'warning',
  none: 'success',
};

const riskLabel: Record<PlatformAuditRiskLevel, string> = {
  high: '高',
  low: '低',
  medium: '中',
  none: '无',
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  });

const escapeCsvCell = (value: unknown) => {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
};

const exportAuditCsv = (items: PlatformAuditItem[]) => {
  const rows = [
    ['时间', '用户', '角色', '模型', '风险等级', '风险标签', '会话', '消息预览'],
    ...items.map((item) => [
      formatDateTime(item.createdAt),
      item.userEmail || item.userId,
      item.role,
      [item.provider, item.model].filter(Boolean).join('/'),
      riskLabel[item.riskLevel],
      item.riskFlags.map((flag) => flag.label).join(';'),
      item.sessionTitle || item.sessionId || '',
      item.contentPreview || '',
    ]),
  ];
  const csv = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `platform-audit-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

const MetricCard = memo<{
  icon: any;
  title: string;
  value?: number;
}>(({ icon, title, value = 0 }) => (
  <Flexbox className={styles.metric} gap={8}>
    <Flexbox horizontal align="center" gap={8}>
      <Icon icon={icon} size={16} />
      <Text className={styles.muted} fontSize={13}>
        {title}
      </Text>
    </Flexbox>
    <Text fontSize={24} weight={600}>
      {value.toLocaleString('zh-CN')}
    </Text>
  </Flexbox>
));

const PlatformAudit = memo(() => {
  const { message } = App.useApp();
  const [range, setRange] = useState<PlatformAuditRange>(1);
  const [feature, setFeature] = useState<PlatformAuditFeatureType | 'all'>('all');
  const [riskLevel, setRiskLevel] = useState<PlatformAuditRiskLevel | 'all'>('all');
  const [email, setEmail] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [activeDetail, setActiveDetail] = useState<PlatformAuditDetail>();
  const [detailLoadingId, setDetailLoadingId] = useState<string>();

  const query = useMemo<PlatformAuditQuery>(
    () => ({
      email: email.trim() || undefined,
      feature,
      range,
      riskLevel,
    }),
    [email, feature, range, riskLevel],
  );

  const { data, error, isLoading } = useClientDataSWR(
    ['platform-audit-dashboard', query],
    () => platformAuditService.getDashboard(query),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  useEffect(() => {
    if (!error) return;

    void message.error('合规审计加载失败，请确认当前账号有管理员权限');
  }, [error, message]);

  const handleViewDetail = useCallback(
    async (record: PlatformAuditItem) => {
      setDetailLoadingId(record.id);
      try {
        const detail = await platformAuditService.getMessageDetail(record.id);
        setActiveDetail(detail);
      } catch (error) {
        void message.error(error instanceof Error ? error.message : '审计详情加载失败');
      } finally {
        setDetailLoadingId(undefined);
      }
    },
    [message],
  );

  const columns = useMemo<ColumnsType<PlatformAuditItem>>(
    () => [
      {
        dataIndex: 'createdAt',
        render: formatDateTime,
        title: '时间',
        width: 112,
      },
      {
        render: (_, record) => (
          <Flexbox gap={2}>
            <Text ellipsis>{record.userEmail || record.userId}</Text>
            <Text ellipsis className={styles.muted} fontSize={12}>
              {record.sessionTitle || record.sessionId || '-'}
            </Text>
          </Flexbox>
        ),
        title: '用户 / 会话',
        width: 220,
      },
      {
        render: (_, record) => (
          <Space wrap size={4}>
            <Tag>{record.role}</Tag>
            {record.agentId && <Tag color="processing">Agent</Tag>}
            {record.tool && <Tag color="blue">工具</Tag>}
            {record.search && <Tag color="cyan">联网</Tag>}
            {record.fileCount > 0 && <Tag>附件 {record.fileCount}</Tag>}
            {record.error && <Tag color="error">错误</Tag>}
          </Space>
        ),
        title: '类型',
        width: 190,
      },
      {
        render: (_, record) => (
          <Text ellipsis>{[record.provider, record.model].filter(Boolean).join('/') || '-'}</Text>
        ),
        title: '模型',
        width: 180,
      },
      {
        render: (_, record) => (
          <Flexbox gap={4}>
            <Tag color={riskColor[record.riskLevel]}>{riskLabel[record.riskLevel]}</Tag>
            <Space wrap size={4}>
              {record.riskFlags.map((flag) => (
                <Tag key={flag.key}>{flag.label}</Tag>
              ))}
            </Space>
          </Flexbox>
        ),
        title: '风险',
        width: 210,
      },
      {
        dataIndex: 'contentPreview',
        render: (value?: string | null) => value || <Text className={styles.muted}>-</Text>,
        title: '消息预览',
      },
      {
        render: (_, record) => (
          <Button
            icon={<Icon icon={Eye} size={14} />}
            loading={detailLoadingId === record.id}
            size="small"
            onClick={() => handleViewDetail(record)}
          >
            查看
          </Button>
        ),
        title: '操作',
        width: 92,
      },
    ],
    [detailLoadingId, handleViewDetail],
  );

  return (
    <>
      <SettingHeader title="合规审计" />
      <Flexbox gap={16}>
        <Text className={styles.muted} fontSize={13}>
          审计数据来自平台已有对话记录；管理员查看原文会被单独留痕。
        </Text>
        <FormGroup collapsible={false} gap={12} title="审计总览" variant="filled">
          <Flexbox horizontal gap={12} wrap="wrap">
            <MetricCard icon={MessageSquare} title="消息数" value={data?.overview.totalMessages} />
            <MetricCard icon={ShieldAlert} title="高风险" value={data?.overview.highRiskMessages} />
            <MetricCard icon={Bot} title="Agent" value={data?.overview.agentMessages} />
            <MetricCard icon={Wrench} title="工具调用" value={data?.overview.toolMessages} />
            <MetricCard icon={Search} title="联网搜索" value={data?.overview.searchMessages} />
            <MetricCard icon={AlertTriangle} title="错误" value={data?.overview.errorMessages} />
          </Flexbox>
        </FormGroup>

        <FormGroup collapsible={false} gap={12} title="审计列表" variant="filled">
          <Flexbox horizontal align="center" gap={8} wrap="wrap">
            <Segmented
              options={rangeOptions}
              value={range}
              variant="outlined"
              onChange={(value) => setRange(value as PlatformAuditRange)}
            />
            <Select
              options={featureOptions}
              style={{ width: 120 }}
              value={feature}
              onChange={(value) => setFeature(value)}
            />
            <Select
              options={riskOptions}
              style={{ width: 120 }}
              value={riskLevel}
              onChange={(value) => setRiskLevel(value)}
            />
            <Input.Search
              allowClear
              placeholder="用户邮箱"
              style={{ width: 220 }}
              value={emailInput}
              onSearch={(value) => setEmail(value.trim())}
              onChange={(event) => {
                const nextValue = event.target.value;
                setEmailInput(nextValue);
                if (!nextValue) setEmail('');
              }}
            />
            <Button
              icon={<Icon icon={Download} size={14} />}
              onClick={() => exportAuditCsv(data?.items || [])}
            >
              导出
            </Button>
          </Flexbox>
          <Table
            className={styles.table}
            columns={columns}
            dataSource={data?.items || []}
            loading={isLoading}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            rowKey="id"
            size="small"
            locale={{
              emptyText: <Empty description="暂无审计记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
            }}
          />
        </FormGroup>
      </Flexbox>
      <Drawer
        destroyOnClose
        open={!!activeDetail}
        title="审计详情"
        width={640}
        onClose={() => setActiveDetail(undefined)}
      >
        {activeDetail && (
          <Flexbox gap={16}>
            <Flexbox gap={8}>
              <Text className={styles.muted}>用户</Text>
              <Text>{activeDetail.userEmail || activeDetail.userId}</Text>
            </Flexbox>
            <Flexbox gap={8}>
              <Text className={styles.muted}>模型</Text>
              <Text>
                {[activeDetail.provider, activeDetail.model].filter(Boolean).join('/') || '-'}
              </Text>
            </Flexbox>
            <Flexbox gap={8}>
              <Text className={styles.muted}>风险标签</Text>
              <Space wrap size={4}>
                <Tag color={riskColor[activeDetail.riskLevel]}>
                  {riskLabel[activeDetail.riskLevel]}
                </Tag>
                {activeDetail.riskFlags.map((flag) => (
                  <Tag key={flag.key}>{flag.label}</Tag>
                ))}
              </Space>
            </Flexbox>
            <Flexbox gap={8}>
              <Text className={styles.muted}>消息原文</Text>
              <div className={styles.content}>
                {activeDetail.content || <Text className={styles.muted}>无内容</Text>}
              </div>
            </Flexbox>
          </Flexbox>
        )}
      </Drawer>
    </>
  );
});

export default PlatformAudit;
