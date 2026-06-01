'use client';

import { Flexbox, FormGroup, Grid, Icon, Segmented, Text } from '@lobehub/ui';
import { App, Empty, Progress, Skeleton, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { createStaticStyles } from 'antd-style';
import {
  Activity,
  AlertTriangle,
  Bot,
  CircleDollarSign,
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
  PlatformAnalyticsRange,
  PlatformAnalyticsTrendItem,
  PlatformAnalyticsUserItem,
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
}));

const metricFormatter = {
  cost: (value: number) => `$${formatNumber(value, 4)}`,
  number: (value: number) => formatNumber(value),
  percent: (value: number) => `${formatNumber(value * 100, 1)}%`,
  token: (value: number) => formatTokenNumber(value),
};

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

const TrendStrip = memo<{ data: PlatformAnalyticsTrendItem[]; isLoading?: boolean }>(
  ({ data, isLoading }) => {
    const maxMessages = Math.max(...data.map((item) => item.totalMessages), 1);

    if (isLoading) return <Skeleton active paragraph={{ rows: 3 }} title={false} />;
    if (data.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />;

    return (
      <Flexbox gap={10}>
        <Flexbox horizontal align={'center'} justify={'space-between'}>
          <Text weight={500}>流量趋势</Text>
          <Text className={styles.muted} fontSize={12}>
            按天聚合消息数、活跃用户和 token
          </Text>
        </Flexbox>
        <Grid gap={8} rows={7}>
          {data.slice(-14).map((item) => {
            const width = `${Math.max((item.totalMessages / maxMessages) * 100, item.totalMessages ? 8 : 0)}%`;

            return (
              <Flexbox className={styles.trendCell} gap={6} key={item.day}>
                <Text className={styles.muted} fontSize={11}>
                  {item.day.slice(5)}
                </Text>
                <div className={styles.bar}>
                  <div className={styles.barInner} style={{ width }} />
                </div>
                <Text fontSize={12} weight={500}>
                  {formatNumber(item.totalMessages)}
                </Text>
              </Flexbox>
            );
          })}
        </Grid>
      </Flexbox>
    );
  },
);

const PlatformAnalytics = memo(() => {
  const { message } = App.useApp();
  const [range, setRange] = useState<PlatformAnalyticsRange>(30);
  const { data, error, isLoading } = useClientDataSWR(['platform-analytics-dashboard', range], () =>
    platformAnalyticsService.getDashboard(range),
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
      { dataIndex: 'userMessages', title: '提问', width: 76 },
      { dataIndex: 'assistantMessages', title: '响应', width: 76 },
      {
        dataIndex: 'totalTokens',
        render: (value: number) => formatTokenNumber(value),
        title: 'Token',
        width: 112,
      },
      {
        dataIndex: 'estimatedCost',
        render: (value: number) => `$${formatNumber(value, 4)}`,
        title: '成本',
        width: 100,
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
        width: '36%',
      },
      { dataIndex: 'assistantMessages', title: '调用', width: 76 },
      { dataIndex: 'activeUsers', title: '用户', width: 76 },
      {
        dataIndex: 'totalTokens',
        render: (value: number) => formatTokenNumber(value),
        title: 'Token',
        width: 112,
      },
      {
        dataIndex: 'estimatedCost',
        render: (value: number) => `$${formatNumber(value, 4)}`,
        title: '成本',
        width: 100,
      },
      {
        dataIndex: 'errorMessages',
        render: (value: number) => (value ? <Tag color="error">{value}</Tag> : <Tag>0</Tag>),
        title: '错误',
        width: 80,
      },
    ],
    [],
  );

  return (
    <>
      <SettingHeader title="平台用量分析" />
      <Flexbox gap={16}>
        <FormGroup
          collapsible={false}
          gap={16}
          title="平台总览"
          variant={'filled'}
          extra={
            <Segmented
              value={range}
              variant={'outlined'}
              options={[
                { label: '7 天', value: 7 },
                { label: '30 天', value: 30 },
                { label: '90 天', value: 90 },
              ]}
              onChange={(value) => setRange(value as PlatformAnalyticsRange)}
            />
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
          <TrendStrip data={data?.trends || []} isLoading={isLoading} />
        </FormGroup>

        <FormGroup collapsible={false} gap={12} title="模型消耗" variant={'filled'}>
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
                <Flexbox className={styles.metric} gap={8} key={`${item.provider}/${item.model}`}>
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

        <FormGroup collapsible={false} gap={12} title="用户排行" variant={'filled'}>
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
      </Flexbox>
    </>
  );
});

export default PlatformAnalytics;
