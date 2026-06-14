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
  Sparkles,
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
  PlatformAuditRiskAnalysis,
  PlatformAuditRiskLevel,
} from '@/types/platformAudit';

const styles = createStaticStyles(({ css, cssVar }) => ({
  analysisCell: css`
    min-width: 0;
    max-height: 58px;
    overflow: hidden;
  `,
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
  filterBar: css`
    padding: 10px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;

    background: ${cssVar.colorBgContainer};
  `,
  filterItem: css`
    min-width: 0;
  `,
  metric: css`
    min-width: 0;
    padding: 12px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;
    background: ${cssVar.colorBgContainer};
  `,
  metricGrid: css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(136px, 1fr));
    gap: 10px;
  `,
  metricIcon: css`
    display: grid;
    place-items: center;

    width: 26px;
    height: 26px;
    border-radius: 6px;

    color: ${cssVar.colorTextSecondary};
    background: ${cssVar.colorFillTertiary};
  `,
  muted: css`
    color: ${cssVar.colorTextDescription};
  `,
  messagePreview: css`
    overflow: hidden;
    display: -webkit-box;

    max-height: 60px;

    line-height: 20px;
    overflow-wrap: anywhere;
    word-break: break-word;

    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
  `,
  notice: css`
    padding: 10px 12px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;

    background: ${cssVar.colorFillQuaternary};
  `,
  riskTags: css`
    min-width: 0;
  `,
  table: css`
    :where(.ant-table) {
      table-layout: fixed;
    }

    :where(.ant-table-cell) {
      vertical-align: top;

      padding: 9px 8px !important;

      white-space: normal;
      word-break: break-word;
    }

    :where(.ant-table-thead > tr > th) {
      white-space: nowrap;
    }

    :where(.ant-tag) {
      margin-inline-end: 0;
    }
  `,
  tableMeta: css`
    padding-block: 2px 8px;
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
  high: '高风险',
  low: '低风险',
  medium: '中风险',
  none: '无风险',
};

const riskShortLabel: Record<PlatformAuditRiskLevel, string> = {
  high: '高',
  low: '低',
  medium: '中',
  none: '无',
};

const normalizeAnalysisRiskLevel = (
  riskLevel?: null | string,
): PlatformAuditRiskLevel =>
  riskLevel === 'high' || riskLevel === 'medium' || riskLevel === 'low' || riskLevel === 'none'
    ? riskLevel
    : 'none';

const buildAnalysisRiskFlags = (analysis: PlatformAuditRiskAnalysis) => {
  const riskLevel = normalizeAnalysisRiskLevel(analysis.riskLevel);
  if (riskLevel === 'none') return [];

  return analysis.riskLabels.map((label) => ({
    key: `ai_${label}`,
    label,
    level: riskLevel,
  }));
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
  <Flexbox className={styles.metric} gap={10}>
    <Flexbox horizontal align="center" gap={8}>
      <div className={styles.metricIcon}>
        <Icon icon={icon} size={15} />
      </div>
      <Text className={styles.muted} fontSize={12}>
        {title}
      </Text>
    </Flexbox>
    <Text fontSize={22} weight={600}>
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
  const [analysisLoadingId, setAnalysisLoadingId] = useState<string>();
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

  const { data, error, isLoading, mutate: refreshDashboard } = useClientDataSWR(
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

  const handleAnalyzeRisk = useCallback(
    async (record: PlatformAuditItem, force?: boolean) => {
      setAnalysisLoadingId(record.id);
      try {
        const analysis = await platformAuditService.analyzeMessageRisk(record.id, force);
        setActiveDetail((detail) =>
          detail?.id === record.id
            ? {
                ...detail,
                analysis,
                riskFlags: buildAnalysisRiskFlags(analysis),
                riskLevel: normalizeAnalysisRiskLevel(analysis.riskLevel),
              }
            : detail,
        );
        await refreshDashboard();
        void message.success('疑点提取已完成');
      } catch (error) {
        void message.error(error instanceof Error ? error.message : '疑点提取失败');
      } finally {
        setAnalysisLoadingId(undefined);
      }
    },
    [message, refreshDashboard],
  );

  const columns = useMemo<ColumnsType<PlatformAuditItem>>(
    () => [
      {
        dataIndex: 'createdAt',
        render: formatDateTime,
        title: '时间',
        width: 102,
      },
      {
        render: (_, record) => {
          const user = record.userEmail || record.userId;
          const session = record.sessionTitle || record.sessionId;

          return (
            <Flexbox gap={2}>
              <Text ellipsis title={user}>
                {user}
              </Text>
              {session && (
                <Text ellipsis className={styles.muted} fontSize={12} title={session}>
                  {session}
                </Text>
              )}
            </Flexbox>
          );
        },
        title: '用户',
        width: 164,
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
        width: 118,
      },
      {
        render: (_, record) => (
          <Text ellipsis>{[record.provider, record.model].filter(Boolean).join('/') || '-'}</Text>
        ),
        title: '模型',
        width: 64,
      },
      {
        render: (_, record) => (
          <Flexbox gap={4}>
            <Tag color={riskColor[record.riskLevel]}>{riskShortLabel[record.riskLevel]}</Tag>
            <Space wrap className={styles.riskTags} size={4}>
              {record.riskFlags.map((flag) => (
                <Tag key={flag.key}>{flag.label}</Tag>
              ))}
            </Space>
          </Flexbox>
        ),
        title: '风险',
        width: 58,
      },
      {
        dataIndex: 'contentPreview',
        render: (value?: string | null) =>
          value ? (
            <div className={styles.messagePreview} title={value}>
              {value}
            </div>
          ) : (
            <Text className={styles.muted}>-</Text>
        ),
        title: '消息预览',
        width: 274,
      },
      {
        render: (_, record) => {
          const analysis = record.analysis;
          if (!analysis) {
            return record.riskLevel === 'none' ? (
              <Tag color="success">普通消息</Tag>
            ) : (
              <Text className={styles.muted}>待复核</Text>
            );
          }

          if (analysis.status === 'running' || analysis.status === 'pending') {
            return <Tag color="processing">分析中</Tag>;
          }

          if (normalizeAnalysisRiskLevel(analysis.riskLevel) === 'none') {
            return <Tag color="success">普通消息</Tag>;
          }

          return (
            <Flexbox className={styles.analysisCell} gap={6}>
              <Text ellipsis>{analysis.summary || '已生成疑点片段'}</Text>
              {analysis.evidence[0] && (
                <Text ellipsis className={styles.muted} fontSize={12}>
                  {analysis.evidence[0].quote}
                </Text>
              )}
              <Button
                icon={<Icon icon={Sparkles} size={14} />}
                loading={analysisLoadingId === record.id}
                size="small"
                type="text"
                onClick={() => handleAnalyzeRisk(record, true)}
              >
                重析
              </Button>
            </Flexbox>
          );
        },
        title: '审计结果',
        width: 88,
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
        width: 64,
      },
    ],
    [analysisLoadingId, detailLoadingId, handleAnalyzeRisk, handleViewDetail],
  );

  return (
    <>
      <SettingHeader title="合规审计" />
      <Flexbox gap={16}>
        <Text className={styles.notice} fontSize={13}>
          风险项由 lite 模型确认；无风险用于查询普通用户提问；管理员查看原文会被留痕。
        </Text>
        <FormGroup collapsible={false} gap={12} title="审计总览" variant="filled">
          <div className={styles.metricGrid}>
            <MetricCard icon={MessageSquare} title="消息数" value={data?.overview.totalMessages} />
            <MetricCard icon={ShieldAlert} title="高风险" value={data?.overview.highRiskMessages} />
            <MetricCard icon={Bot} title="Agent" value={data?.overview.agentMessages} />
            <MetricCard icon={Wrench} title="工具调用" value={data?.overview.toolMessages} />
            <MetricCard icon={Search} title="联网搜索" value={data?.overview.searchMessages} />
            <MetricCard icon={AlertTriangle} title="错误" value={data?.overview.errorMessages} />
          </div>
        </FormGroup>

        <FormGroup collapsible={false} gap={12} title="审计列表" variant="filled">
          <Flexbox className={styles.filterBar} gap={10}>
            <Flexbox horizontal align="center" gap={10} wrap="wrap">
              <Flexbox className={styles.filterItem} gap={4}>
                <Text className={styles.muted} fontSize={12}>
                  时间范围
                </Text>
                <Segmented
                  options={rangeOptions}
                  value={range}
                  onChange={(value) => setRange(value as PlatformAuditRange)}
                />
              </Flexbox>
              <Flexbox className={styles.filterItem} gap={4}>
                <Text className={styles.muted} fontSize={12}>
                  场景
                </Text>
                <Select
                  options={featureOptions}
                  style={{ width: 128 }}
                  value={feature}
                  onChange={(value) => setFeature(value)}
                />
              </Flexbox>
              <Flexbox className={styles.filterItem} gap={4}>
                <Text className={styles.muted} fontSize={12}>
                  风险
                </Text>
                <Select
                  options={riskOptions}
                  style={{ width: 128 }}
                  value={riskLevel}
                  onChange={(value) => setRiskLevel(value)}
                />
              </Flexbox>
              <Flexbox className={styles.filterItem} gap={4}>
                <Text className={styles.muted} fontSize={12}>
                  用户
                </Text>
                <Input.Search
                  allowClear
                  placeholder="邮箱或前缀"
                  style={{ width: 240 }}
                  value={emailInput}
                  onSearch={(value) => setEmail(value.trim())}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setEmailInput(nextValue);
                    if (!nextValue) setEmail('');
                  }}
                />
              </Flexbox>
              <Button
                icon={<Icon icon={Download} size={14} />}
                onClick={() => exportAuditCsv(data?.items || [])}
              >
                导出
              </Button>
            </Flexbox>
            <Text className={styles.tableMeta} fontSize={12}>
              当前显示 {data?.items.length ?? 0} 条记录
            </Text>
          </Flexbox>
          <Table
            className={styles.table}
            columns={columns}
            dataSource={data?.items || []}
            loading={isLoading}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            rowKey="id"
            scroll={{ x: 932 }}
            size="small"
            tableLayout="fixed"
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
            <Flexbox gap={8}>
              <Flexbox horizontal align="center" justify="space-between">
                <Text className={styles.muted}>疑点提取</Text>
                <Button
                  disabled={!activeDetail.analysis}
                  icon={<Icon icon={Sparkles} size={14} />}
                  loading={analysisLoadingId === activeDetail.id}
                  size="small"
                  onClick={() => handleAnalyzeRisk(activeDetail, !!activeDetail.analysis)}
                >
                  重新分析
                </Button>
              </Flexbox>
              {activeDetail.analysis ? (
                <Flexbox gap={8}>
                  <Text>{activeDetail.analysis.summary || '已生成疑点片段'}</Text>
                  <Text className={styles.muted} fontSize={13}>
                    {activeDetail.analysis.reason || '-'}
                  </Text>
                  <Space wrap size={4}>
                    {activeDetail.analysis.riskLabels.map((label) => (
                      <Tag key={label}>{label}</Tag>
                    ))}
                  </Space>
                  <Flexbox gap={6}>
                    {activeDetail.analysis.evidence.map((item) => (
                      <div className={styles.content} key={`${item.label}-${item.quote}`}>
                        <Text weight={600}>{item.label}</Text>
                        <br />
                        <Text>{item.quote}</Text>
                      </div>
                    ))}
                  </Flexbox>
                  {activeDetail.analysis.error && (
                    <Text className={styles.muted} fontSize={12}>
                      模型提取失败，已使用规则提取：{activeDetail.analysis.error}
                    </Text>
                  )}
                </Flexbox>
              ) : (
                <Text className={styles.muted}>尚未生成疑点片段</Text>
              )}
            </Flexbox>
          </Flexbox>
        )}
      </Drawer>
    </>
  );
});

export default PlatformAudit;
