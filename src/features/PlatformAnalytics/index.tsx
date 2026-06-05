'use client';

import { Flexbox, FormGroup, Grid, Icon, Segmented, Text } from '@lobehub/ui';
import { App, DatePicker, Empty, Progress, Skeleton, Table, Tag } from 'antd';
import type { RangePickerProps } from 'antd/es/date-picker';
import type { ColumnsType } from 'antd/es/table';
import { createStaticStyles } from 'antd-style';
import dayjs, { type Dayjs } from 'dayjs';
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  Inbox,
  LifeBuoy,
  MessageSquare,
  Search,
  Sparkles,
  Users,
  Wrench,
} from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';

import { useClientDataSWR } from '@/libs/swr';
import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';
import { platformAnalyticsService } from '@/services/platformAnalytics';
import type {
  PlatformAnalyticsFeatureItem,
  PlatformAnalyticsModelItem,
  PlatformAnalyticsQuery,
  PlatformAnalyticsRange,
  PlatformAnalyticsTrendItem,
  PlatformAnalyticsUserItem,
  PlatformFeedbackReportItem,
} from '@/types/platformAnalytics';
import { formatNumber, formatTokenNumber } from '@/utils/format';

const styles = createStaticStyles(({ css, cssVar }) => ({
  bar: css`
    overflow: hidden;
    width: 100%;
    height: 8px;
    border-radius: 999px;
    background: ${cssVar.colorFillTertiary};
  `,
  barInner: css`
    height: 100%;
    border-radius: 999px;
    background: ${cssVar.colorPrimary};
  `,
  metric: css`
    min-height: 112px;
    padding: 16px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;
    background: ${cssVar.colorBgContainer};
  `,
  metricIcon: css`
    display: grid;
    place-items: center;

    width: 32px;
    height: 32px;
    border-radius: 8px;

    color: ${cssVar.colorPrimary};
    background: ${cssVar.colorFillQuaternary};
  `,
  muted: css`
    color: ${cssVar.colorTextDescription};
  `,
  rangePicker: css`
    width: 260px;
  `,
  trendChart: css`
    overflow: hidden;
    width: 100%;
    min-height: 240px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;
    background: ${cssVar.colorBgContainer};
  `,
  trendGridLine: css`
    stroke: ${cssVar.colorBorderSecondary};
    stroke-width: 1;
  `,
  trendLine: css`
    fill: none;
    stroke: ${cssVar.colorPrimary};
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
  `,
  trendPoint: css`
    fill: ${cssVar.colorBgContainer};
    stroke: ${cssVar.colorPrimary};
    stroke-width: 2;
  `,
  trendSvg: css`
    display: block;
    width: 100%;
    height: 220px;
  `,
  nav: css`
    width: fit-content;
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
  trendCell: css`
    min-width: 72px;
  `,
  wrap: css`
    white-space: normal;
    word-break: break-word;
  `,
}));

const metricFormatter = {
  cost: (value: number) => `$${formatNumber(value, 4)}`,
  number: (value: number) => formatNumber(value),
  percent: (value: number) => `${formatNumber(value * 100, 1)}%`,
  token: (value: number) => formatTokenNumber(value),
};

const formatLatency = (value?: number) => {
  if (!value) return '-';

  if (value < 1000) return `${formatNumber(Math.round(value))}ms`;

  return `${formatNumber(value / 1000, 1)}s`;
};

const formatDateTime = (value?: string) => {
  if (!value) return '-';

  return new Date(value).toLocaleString('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  });
};

const feedbackStatusMap = {
  ignored: { color: 'default', label: '已忽略' },
  open: { color: 'processing', label: '待处理' },
  resolved: { color: 'success', label: '已解决' },
  reviewing: { color: 'warning', label: '跟进中' },
} as const;

const rangeOptions = [
  { label: '当天', value: 1 },
  { label: '7 天', value: 7 },
  { label: '30 天', value: 30 },
  { label: '90 天', value: 90 },
];

type UsageRangeMode = PlatformAnalyticsRange | 'custom';
type DateRangeValue = Parameters<NonNullable<RangePickerProps['onChange']>>[0];

const usageRangeOptions = [...rangeOptions, { label: '自定义', value: 'custom' }];

const disabledFutureDate: NonNullable<RangePickerProps['disabledDate']> = (current) =>
  current.isAfter(dayjs(), 'day');

interface MetricCardProps {
  description: string;
  icon: typeof Users;
  title: string;
  type?: keyof typeof metricFormatter;
  value?: number;
}

const MetricCard = memo<MetricCardProps>(
  ({ description, icon, title, type = 'number', value = 0 }) => {
    return (
      <Flexbox className={styles.metric} gap={12}>
        <Flexbox horizontal align={'center'} justify={'space-between'}>
          <Text className={styles.muted} fontSize={13}>
            {title}
          </Text>
          <span className={styles.metricIcon}>
            <Icon icon={icon} size={17} />
          </span>
        </Flexbox>
        <Text fontSize={26} weight={600}>
          {metricFormatter[type](value)}
        </Text>
        <Text className={styles.muted} fontSize={12}>
          {description}
        </Text>
      </Flexbox>
    );
  },
);

const TrendLineChart = memo<{ data: PlatformAnalyticsTrendItem[]; isLoading?: boolean }>(
  ({ data, isLoading }) => {
    const maxMessages = Math.max(...data.map((item) => item.totalMessages), 1);

    if (isLoading) return <Skeleton active paragraph={{ rows: 3 }} title={false} />;
    if (data.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />;

    const width = 720;
    const height = 220;
    const padding = { bottom: 36, left: 48, right: 20, top: 24 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const points = data.map((item, index) => {
      const x =
        data.length === 1
          ? padding.left + chartWidth / 2
          : padding.left + (index / (data.length - 1)) * chartWidth;
      const y =
        padding.top + chartHeight - (item.totalMessages / maxMessages) * Math.max(chartHeight, 1);

      return { item, x, y };
    });
    const polyline = points.map((point) => `${point.x},${point.y}`).join(' ');
    const labelStep = Math.max(Math.ceil(data.length / 8), 1);

    return (
      <Flexbox gap={10}>
        <Flexbox horizontal align={'center'} justify={'space-between'}>
          <Text weight={500}>流量走势图</Text>
          <Text className={styles.muted} fontSize={12}>
            按北京时间聚合消息数、活跃用户和 token
          </Text>
        </Flexbox>
        <Flexbox className={styles.trendChart} gap={8}>
          <svg className={styles.trendSvg} role="img" viewBox={`0 0 ${width} ${height}`}>
            <title>平台消息量折线趋势</title>
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padding.top + ratio * chartHeight;
              const value = Math.round(maxMessages * (1 - ratio));

              return (
                <g key={ratio}>
                  <line
                    className={styles.trendGridLine}
                    x1={padding.left}
                    x2={width - padding.right}
                    y1={y}
                    y2={y}
                  />
                  <text
                    fill="currentColor"
                    fontSize="11"
                    opacity="0.55"
                    textAnchor="end"
                    x={40}
                    y={y + 4}
                  >
                    {formatNumber(value)}
                  </text>
                </g>
              );
            })}
            <polyline className={styles.trendLine} points={polyline} />
            {points.map((point, index) => (
              <g key={point.item.day}>
                <circle className={styles.trendPoint} cx={point.x} cy={point.y} r={4}>
                  <title>
                    {`${point.item.day} 消息 ${formatNumber(point.item.totalMessages)}，活跃用户 ${formatNumber(
                      point.item.activeUsers,
                    )}，Token ${formatTokenNumber(point.item.totalTokens)}`}
                  </title>
                </circle>
                {index % labelStep === 0 || index === points.length - 1 ? (
                  <text
                    fill="currentColor"
                    fontSize="11"
                    opacity="0.55"
                    textAnchor="middle"
                    x={point.x}
                    y={height - 10}
                  >
                    {point.item.day.slice(5)}
                  </text>
                ) : null}
              </g>
            ))}
          </svg>
          <Grid gap={8} maxItemWidth={180} rows={4}>
            {data.slice(-4).map((item) => (
              <Flexbox className={styles.trendCell} gap={4} key={item.day}>
                <Text className={styles.muted} fontSize={11}>
                  {item.day}
                </Text>
                <Text fontSize={13} weight={500}>
                  {formatNumber(item.totalMessages)} 条消息
                </Text>
                <Text className={styles.muted} fontSize={12}>
                  {formatNumber(item.activeUsers)} 人 · {formatTokenNumber(item.totalTokens)}
                </Text>
              </Flexbox>
            ))}
          </Grid>
        </Flexbox>
      </Flexbox>
    );
  },
);

interface FeedbackAnalyticsPanelProps {
  range: PlatformAnalyticsRange;
  setRange: (range: PlatformAnalyticsRange) => void;
}

const FeedbackAnalyticsPanel = memo<FeedbackAnalyticsPanelProps>(({ range, setRange }) => {
  const { message } = App.useApp();
  const { data, error, isLoading } = useClientDataSWR(['platform-feedback-analytics', range], () =>
    platformAnalyticsService.getFeedback(range),
  );

  useEffect(() => {
    if (!error) return;

    void message.error('问题反馈分析加载失败，请稍后重试或确认当前账号有访问权限');
  }, [error, message]);

  const feedbackColumns = useMemo<ColumnsType<PlatformFeedbackReportItem>>(
    () => [
      {
        dataIndex: 'createdAt',
        render: (value: string) => (
          <Text className={styles.muted} fontSize={12}>
            {formatDateTime(value)}
          </Text>
        ),
        title: '时间',
        width: 104,
      },
      {
        render: (_, record) => (
          <Flexbox gap={2}>
            <Text ellipsis weight={500}>
              {record.email || record.userId || '未知用户'}
            </Text>
            {record.userId && (
              <Text ellipsis className={styles.muted} fontSize={12}>
                {record.userId}
              </Text>
            )}
          </Flexbox>
        ),
        title: '用户',
        width: '22%',
      },
      {
        render: (_, record) => (
          <Flexbox gap={4}>
            <Text className={styles.wrap} weight={500}>
              {record.title}
            </Text>
            <Text className={styles.muted} fontSize={12}>
              {record.message}
            </Text>
          </Flexbox>
        ),
        title: '反馈内容',
        width: '36%',
      },
      {
        dataIndex: 'pageUrl',
        render: (value?: string) =>
          value ? (
            <a href={value} rel="noreferrer" target="_blank">
              页面 <Icon icon={ExternalLink} size={12} />
            </a>
          ) : (
            '-'
          ),
        title: '页面',
        width: 82,
      },
      {
        dataIndex: 'status',
        render: (value: PlatformFeedbackReportItem['status']) => {
          const status = feedbackStatusMap[value] || feedbackStatusMap.open;

          return <Tag color={status.color}>{status.label}</Tag>;
        },
        title: '状态',
        width: 88,
      },
      {
        render: (_, record) => (
          <Flexbox gap={4}>
            {record.screenshotUrl && (
              <a href={record.screenshotUrl} rel="noreferrer" target="_blank">
                截图
              </a>
            )}
            {record.issueUrl && (
              <a href={record.issueUrl} rel="noreferrer" target="_blank">
                Market
              </a>
            )}
            {!record.screenshotUrl && !record.issueUrl && '-'}
          </Flexbox>
        ),
        title: '附件',
        width: 80,
      },
    ],
    [],
  );

  return (
    <Flexbox gap={16}>
      <FormGroup
        collapsible={false}
        gap={16}
        title="问题反馈总览"
        variant={'filled'}
        extra={
          <Segmented
            options={rangeOptions}
            value={range}
            variant={'outlined'}
            onChange={(value) => setRange(value as PlatformAnalyticsRange)}
          />
        }
      >
        <Grid gap={12} maxItemWidth={220} rows={4}>
          <MetricCard
            description="当前时间范围内收到的反馈"
            icon={LifeBuoy}
            title="反馈总数"
            value={data?.overview.total}
          />
          <MetricCard
            description="需要管理员处理"
            icon={Inbox}
            title="待处理"
            value={data?.overview.open}
          />
          <MetricCard
            description="已经进入排查或沟通"
            icon={Clock3}
            title="跟进中"
            value={data?.overview.reviewing}
          />
          <MetricCard
            description="已经完成闭环"
            icon={CheckCircle2}
            title="已解决"
            value={data?.overview.resolved}
          />
        </Grid>
      </FormGroup>

      <FormGroup collapsible={false} gap={12} title="反馈明细" variant={'filled'}>
        <Table
          className={styles.table}
          columns={feedbackColumns}
          dataSource={data?.items || []}
          loading={isLoading}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          rowKey="id"
          size="small"
          tableLayout="fixed"
          locale={{
            emptyText: (
              <Empty description="当前时间范围内暂无反馈" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ),
          }}
        />
      </FormGroup>
    </Flexbox>
  );
});

interface PlatformAnalyticsProps {
  defaultView?: 'feedback' | 'usage';
}

const PlatformAnalytics = memo<PlatformAnalyticsProps>(({ defaultView = 'usage' }) => {
  const { message } = App.useApp();
  const [feedbackRange, setFeedbackRange] = useState<PlatformAnalyticsRange>(1);
  const [usageRange, setUsageRange] = useState<PlatformAnalyticsRange>(1);
  const [usageRangeMode, setUsageRangeMode] = useState<UsageRangeMode>(1);
  const [customRange, setCustomRange] = useState<[Dayjs, Dayjs]>(() => [
    dayjs().subtract(13, 'day'),
    dayjs(),
  ]);
  const [view, setView] = useState<'feedback' | 'usage'>(defaultView);
  const dashboardQuery = useMemo<PlatformAnalyticsQuery>(() => {
    if (usageRangeMode !== 'custom') return { range: usageRangeMode };

    return {
      customRange: {
        end: customRange[1].endOf('day').toISOString(),
        start: customRange[0].startOf('day').toISOString(),
      },
      range: usageRange,
    };
  }, [customRange, usageRange, usageRangeMode]);
  const { data, error, isLoading } = useClientDataSWR(
    view === 'usage'
      ? [
          'platform-analytics-dashboard',
          dashboardQuery.range,
          dashboardQuery.customRange?.start,
          dashboardQuery.customRange?.end,
        ]
      : null,
    () => platformAnalyticsService.getDashboard(dashboardQuery),
  );

  useEffect(() => {
    if (!error) return;

    void message.error('平台用量分析加载失败，请稍后重试或确认当前账号有访问权限');
  }, [error, message]);

  const maxFeatureCount = Math.max(...(data?.features || []).map((item) => item.count), 1);

  const userColumns = useMemo<ColumnsType<PlatformAnalyticsUserItem>>(
    () => [
      {
        dataIndex: 'userName',
        render: (_, record) => (
          <Flexbox gap={2}>
            <Text ellipsis weight={500}>
              {record.userName || record.userId}
            </Text>
            <Text ellipsis className={styles.muted} fontSize={12}>
              {record.userEmail || record.userId}
            </Text>
          </Flexbox>
        ),
        title: '用户',
        width: '34%',
      },
      { dataIndex: 'activeDays', title: '活跃天', width: 76 },
      {
        render: (_, record) =>
          record.model ? (
            <Flexbox gap={2}>
              <Text ellipsis>{record.model}</Text>
              <Text className={styles.muted} fontSize={12}>
                {record.provider}
              </Text>
            </Flexbox>
          ) : (
            '-'
          ),
        title: '模型',
        width: '24%',
      },
      { dataIndex: 'requestCount', title: '请求', width: 76 },
      {
        dataIndex: 'totalTokens',
        render: (value: number) => formatTokenNumber(value),
        title: 'Token',
        width: 112,
      },
      {
        dataIndex: 'errorMessages',
        render: (value: number) => (value ? <Tag color="error">{value}</Tag> : <Tag>0</Tag>),
        title: '错误',
        width: 72,
      },
      {
        dataIndex: 'averageLatencyMs',
        render: (value: number) => formatLatency(value),
        title: '平均耗时',
        width: 92,
      },
    ],
    [],
  );

  const modelColumns = useMemo<ColumnsType<PlatformAnalyticsModelItem>>(
    () => [
      {
        render: (_, record) => (
          <Flexbox gap={2}>
            <Text ellipsis weight={500}>
              {record.model}
            </Text>
            <Text className={styles.muted} fontSize={12}>
              {record.provider}
            </Text>
          </Flexbox>
        ),
        title: '模型',
        width: '30%',
      },
      { dataIndex: 'requestCount', title: '请求', width: 72 },
      { dataIndex: 'llmCalls', title: 'LLM', width: 72 },
      { dataIndex: 'activeUsers', title: '用户', width: 76 },
      {
        dataIndex: 'totalTokens',
        render: (value: number) => formatTokenNumber(value),
        title: 'Token',
        width: 112,
      },
      {
        dataIndex: 'errorRate',
        render: (value: number) =>
          value > 0 ? <Tag color="error">{metricFormatter.percent(value)}</Tag> : <Tag>0%</Tag>,
        title: '错误率',
        width: 84,
      },
      {
        dataIndex: 'averageLatencyMs',
        render: (value: number) => formatLatency(value),
        title: '平均',
        width: 76,
      },
      {
        dataIndex: 'p95LatencyMs',
        render: (value: number) => formatLatency(value),
        title: 'P95',
        width: 76,
      },
    ],
    [],
  );

  return (
    <>
      <SettingHeader title="平台用量分析" />
      <Flexbox gap={16}>
        <Segmented
          className={styles.nav}
          value={view}
          variant={'outlined'}
          options={[
            { label: '用量分析', value: 'usage' },
            { label: '问题反馈分析', value: 'feedback' },
          ]}
          onChange={(value) => setView(value as 'feedback' | 'usage')}
        />
        {view === 'feedback' ? (
          <FeedbackAnalyticsPanel range={feedbackRange} setRange={setFeedbackRange} />
        ) : (
          <>
            <FormGroup
              collapsible={false}
              gap={16}
              title="平台总览"
              variant={'filled'}
              extra={
                <Flexbox horizontal align={'center'} gap={8} wrap={'wrap'}>
                  <Segmented
                    options={usageRangeOptions}
                    value={usageRangeMode}
                    variant={'outlined'}
                    onChange={(value) => {
                      const nextMode = value as UsageRangeMode;
                      setUsageRangeMode(nextMode);
                      if (nextMode !== 'custom') setUsageRange(nextMode);
                    }}
                  />
                  {usageRangeMode === 'custom' && (
                    <DatePicker.RangePicker
                      allowClear={false}
                      className={styles.rangePicker}
                      disabledDate={disabledFutureDate}
                      value={customRange}
                      onChange={(value: DateRangeValue) => {
                        if (!value?.[0] || !value?.[1]) return;
                        setCustomRange([value[0], value[1]]);
                      }}
                    />
                  )}
                </Flexbox>
              }
            >
              <Grid gap={12} maxItemWidth={220} rows={4}>
                <MetricCard
                  description={`全平台累计 ${formatNumber(data?.overview.totalUsers || 0)} 位用户`}
                  icon={Users}
                  title="活跃用户"
                  value={data?.overview.activeUsers}
                />
                <MetricCard
                  description="用户消息数量"
                  icon={MessageSquare}
                  title="用户提问"
                  value={data?.overview.userMessages}
                />
                <MetricCard
                  description="模型响应数量"
                  icon={Bot}
                  title="模型调用"
                  value={data?.overview.assistantMessages}
                />
                <MetricCard
                  description="估算输入和输出总量"
                  icon={Activity}
                  title="Token 消耗"
                  type="token"
                  value={data?.overview.totalTokens}
                />
                <MetricCard
                  description="按消息 metadata 汇总"
                  icon={CircleDollarSign}
                  title="估算成本"
                  type="cost"
                  value={data?.overview.estimatedCost}
                />
                <MetricCard
                  description="有 search 记录的消息"
                  icon={Search}
                  title="联网搜索"
                  value={data?.overview.searchMessages}
                />
                <MetricCard
                  description="有 tools 记录的消息"
                  icon={Wrench}
                  title="工具调用"
                  value={data?.overview.toolMessages}
                />
                <MetricCard
                  description="assistant 错误占比"
                  icon={AlertTriangle}
                  title="错误率"
                  type="percent"
                  value={data?.overview.errorRate}
                />
              </Grid>
              <TrendLineChart data={data?.trends || []} isLoading={isLoading} />
            </FormGroup>

            <FormGroup collapsible={false} gap={12} title="模型吞吐监控" variant={'filled'}>
              <Table
                className={styles.table}
                columns={modelColumns}
                dataSource={data?.models || []}
                loading={isLoading}
                pagination={false}
                rowKey={(record) => `${record.provider}/${record.model}`}
                size="small"
                tableLayout="fixed"
              />
            </FormGroup>

            <FormGroup collapsible={false} gap={12} title="功能使用" variant={'filled'}>
              <Grid gap={12} maxItemWidth={240} rows={4}>
                {(data?.features || []).map((item: PlatformAnalyticsFeatureItem) => (
                  <Flexbox className={styles.metric} gap={10} key={item.key}>
                    <Flexbox horizontal align={'center'} justify={'space-between'}>
                      <Text weight={500}>{item.label}</Text>
                      <Tag>{formatNumber(item.activeUsers)} 人</Tag>
                    </Flexbox>
                    <Text fontSize={24} weight={600}>
                      {formatNumber(item.count)}
                    </Text>
                    <Progress
                      percent={Math.round((item.count / maxFeatureCount) * 100)}
                      showInfo={false}
                      size="small"
                    />
                  </Flexbox>
                ))}
              </Grid>
            </FormGroup>

            <FormGroup collapsible={false} gap={12} title="异常模型" variant={'filled'}>
              {data?.errors.length ? (
                <Grid gap={12} rows={4}>
                  {data.errors.map((item) => (
                    <Flexbox
                      className={styles.metric}
                      gap={8}
                      key={`${item.provider}/${item.model}`}
                    >
                      <Flexbox horizontal align={'center'} gap={8}>
                        <Icon icon={Sparkles} />
                        <Text ellipsis weight={500}>
                          {item.model}
                        </Text>
                      </Flexbox>
                      <Text className={styles.muted} fontSize={12}>
                        {item.provider}
                      </Text>
                      <Tag color="error">{formatNumber(item.count)} 次错误</Tag>
                    </Flexbox>
                  ))}
                </Grid>
              ) : (
                <Empty
                  description="当前时间范围内没有模型错误记录"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )}
            </FormGroup>

            <FormGroup collapsible={false} gap={12} title="用户模型请求排行" variant={'filled'}>
              <Table
                className={styles.table}
                columns={userColumns}
                dataSource={data?.topUsers || []}
                loading={isLoading}
                pagination={false}
                rowKey="userId"
                size="small"
                tableLayout="fixed"
              />
            </FormGroup>
          </>
        )}
      </Flexbox>
    </>
  );
});

export default PlatformAnalytics;
