'use client';

import { formatNumber, formatUsageValue } from '@lobechat/utils';
import { Flexbox } from '@lobehub/ui';
import { Avatar, Text, Tooltip } from '@lobehub/ui/base-ui';
import type { TableColumnsType } from 'antd';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncBoundary from '@/components/AsyncBoundary';
import AsyncError from '@/components/AsyncError';
import InlineTable from '@/components/InlineTable';
import TablePagination from '@/components/TablePagination';
import type {
  CottiPlatformAnalyticsAgentItem,
  CottiPlatformAnalyticsAgentSort,
} from '@/types/cotti/platformAnalytics';

import TotalToken from './CompactTokens';
import type { CottiPlatformAnalyticsDetailListState } from './detail';
import { DetailEmpty } from './DetailEmpty';
import { DetailTableSkeleton } from './DetailTableSkeleton';
import { DetailToolbar } from './DetailToolbar';
import { formatCost, formatUsd } from './format';
import { useCottiPlatformAnalyticsAgents } from './hooks';
import type { CottiPlatformAnalyticsRangeSelection } from './range';
import { styles } from './style';

interface AgentUsageTableProps {
  enabled: boolean;
  onPageChange: (page: number, pageSize: 20 | 50) => void;
  onQueryChange: (value: string) => void;
  onSortChange: (value: CottiPlatformAnalyticsAgentSort) => void;
  range: CottiPlatformAnalyticsRangeSelection;
  state: CottiPlatformAnalyticsDetailListState<CottiPlatformAnalyticsAgentSort>;
}

const formatPercent = (value: number) => `${formatNumber(value * 100, 2)}%`;

const formatDuration = (value: number) => {
  if (value < 1000) return `${formatNumber(value)} ms`;
  if (value < 60_000) return `${formatNumber(value / 1000, 1)} s`;
  if (value < 3_600_000) return `${formatNumber(value / 60_000, 1)} min`;

  return `${formatNumber(value / 3_600_000, 1)} h`;
};

export const AgentUsageTable = memo<AgentUsageTableProps>(
  ({ enabled, onPageChange, onQueryChange, onSortChange, range, state }) => {
    const { i18n, t } = useTranslation('setting');
    const swr = useCottiPlatformAnalyticsAgents(range, state, enabled);
    const data = swr.data;
    const hasQuery = Boolean(state.q.trim());
    const columns = useMemo<TableColumnsType<CottiPlatformAnalyticsAgentItem>>(
      () => [
        {
          dataIndex: 'agentId',
          fixed: 'left',
          key: 'agent',
          render: (_value, record) => {
            const title = record.title || t('platformAnalytics.details.agents.unattributed');

            return (
              <Flexbox horizontal align={'center'} className={styles.detailIdentity} gap={10}>
                <Avatar avatar={record.avatar || title} size={28} />
                <Flexbox className={styles.detailIdentityCopy} gap={2}>
                  <Tooltip title={title}>
                    <Text ellipsis weight={500}>
                      {title}
                    </Text>
                  </Tooltip>
                  {!record.agentId && (
                    <Text ellipsis fontSize={12} type={'secondary'}>
                      {t('platformAnalytics.details.agents.identityMissing')}
                    </Text>
                  )}
                </Flexbox>
              </Flexbox>
            );
          },
          title: t('platformAnalytics.details.columns.agent'),
          width: 240,
        },
        {
          align: 'right',
          dataIndex: 'recordedCost',
          key: 'recordedCost',
          render: (value, record) => (
            <Tooltip
              title={`${formatUsd(value)} · ${t('platformAnalytics.details.agents.coverage', { executions: formatNumber(record.executions), recorded: formatNumber(record.costRecordedExecutions) })}`}
            >
              <span>{formatCost(value)}</span>
            </Tooltip>
          ),
          title: t('platformAnalytics.details.columns.cost'),
          width: 112,
        },
        {
          align: 'right',
          dataIndex: 'activeUsers',
          key: 'activeUsers',
          render: (value) => formatUsageValue(value),
          title: t('platformAnalytics.details.columns.activeUsers'),
          width: 108,
        },
        {
          align: 'right',
          dataIndex: 'executions',
          key: 'executions',
          render: (value) => formatUsageValue(value),
          title: t('platformAnalytics.details.columns.executions'),
          width: 108,
        },
        {
          dataIndex: 'llmCalls',
          key: 'calls',
          render: (_value, record) =>
            t('platformAnalytics.details.agents.callsValue', {
              llmCalls: formatUsageValue(record.llmCalls),
              toolCalls: formatUsageValue(record.toolCalls),
            }),
          title: t('platformAnalytics.details.columns.calls'),
          width: 176,
        },
        {
          dataIndex: 'totalTokens',
          key: 'totalTokens',
          render: (value, record) => (
            <Tooltip
              title={t('platformAnalytics.details.agents.coverage', {
                executions: formatNumber(record.executions),
                recorded: formatNumber(record.tokenRecordedExecutions),
              })}
            >
              <div>
                <TotalToken
                  totalInputTokens={record.totalInputTokens}
                  totalOutputTokens={record.totalOutputTokens}
                  totalTokens={value}
                />
              </div>
            </Tooltip>
          ),
          title: t('platformAnalytics.details.columns.tokens'),
          width: 120,
        },

        {
          dataIndex: 'errorExecutions',
          key: 'outcomes',
          render: (_value, record) => (
            <Tooltip
              title={t('platformAnalytics.details.agents.outcomeRates', {
                errorRate: formatPercent(record.errorRate),
                interruptionRate: formatPercent(record.interruptionRate),
              })}
            >
              <span>
                {t('platformAnalytics.details.agents.outcomesValue', {
                  errors: formatUsageValue(record.errorExecutions),
                  interruptions: formatUsageValue(record.interruptedExecutions),
                })}
              </span>
            </Tooltip>
          ),
          title: t('platformAnalytics.details.columns.outcomes'),
          width: 184,
        },
        {
          align: 'right',
          dataIndex: 'averageProcessingTimeMs',
          key: 'averageProcessingTimeMs',
          render: (value) => formatDuration(value),
          title: t('platformAnalytics.details.columns.averageDuration'),
          width: 128,
        },
        {
          dataIndex: 'lastExecutedAt',
          key: 'lastExecutedAt',
          render: (value) =>
            value
              ? new Intl.DateTimeFormat(i18n.language, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: data?.period.timezone ?? 'Asia/Shanghai',
                }).format(new Date(value))
              : t('platformAnalytics.details.agents.noExecutionTime'),
          title: t('platformAnalytics.details.columns.lastExecutedAt'),
          width: 176,
        },
      ],
      [data?.period.timezone, i18n.language, t],
    );
    const sortOptions = useMemo(
      () =>
        [
          {
            label: t('platformAnalytics.details.sort.totalTokens'),
            value: 'totalTokens',
          },
          {
            label: t('platformAnalytics.details.sort.executions'),
            value: 'executions',
          },
          {
            label: t('platformAnalytics.details.sort.activeUsers'),
            value: 'activeUsers',
          },
          {
            label: t('platformAnalytics.details.sort.recordedCost'),
            value: 'recordedCost',
          },
          {
            label: t('platformAnalytics.details.sort.errorExecutions'),
            value: 'errorExecutions',
          },
          {
            label: t('platformAnalytics.details.sort.averageProcessingTimeMs'),
            value: 'averageProcessingTimeMs',
          },
          {
            label: t('platformAnalytics.details.sort.lastExecutedAt'),
            value: 'lastExecutedAt',
          },
        ] satisfies Array<{ label: string; value: CottiPlatformAnalyticsAgentSort }>,
      [t],
    );

    return (
      <>
        <DetailToolbar
          isRefreshing={swr.isValidating}
          placeholder={t('platformAnalytics.details.agents.search')}
          query={state.q}
          sortBy={state.sortBy}
          sortOptions={sortOptions}
          onQueryChange={onQueryChange}
          onRefresh={() => void swr.mutate()}
          onSortChange={onSortChange}
        />
        {data && swr.error && (
          <div className={styles.detailInlineError}>
            <AsyncError error={swr.error} variant={'inline'} onRetry={() => void swr.mutate()} />
          </div>
        )}
        <AsyncBoundary
          data={data}
          error={swr.error}
          isEmpty={!swr.error && data?.items.length === 0}
          isLoading={swr.isLoading}
          empty={
            <DetailEmpty
              emptyDescription={t('platformAnalytics.details.agents.empty.desc')}
              emptyTitle={t('platformAnalytics.details.agents.empty.title')}
              hasQuery={hasQuery}
              onClearQuery={() => onQueryChange('')}
              onRefresh={() => void swr.mutate()}
            />
          }
          loading={
            <DetailTableSkeleton
              columns={columns.map((column) => ({
                title: String(column.title ?? ''),
                width: typeof column.width === 'number' ? column.width : undefined,
              }))}
            />
          }
          onRetry={() => void swr.mutate()}
        >
          <InlineTable<CottiPlatformAnalyticsAgentItem>
            columns={columns}
            dataSource={data?.items}
            rowKey={(record) => record.agentId ?? '__unattributed_agent__'}
            size={'small'}
          />
          {data && data.total > 0 && (
            <TablePagination
              current={data.page}
              pageSize={data.pageSize}
              pageSizeOptions={[20, 50]}
              total={data.total}
              onChange={(page, pageSize) => onPageChange(page, pageSize as 20 | 50)}
            />
          )}
        </AsyncBoundary>
      </>
    );
  },
);

AgentUsageTable.displayName = 'AgentUsageTable';
