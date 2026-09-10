'use client';

import { formatUsageValue } from '@lobechat/utils';
import { Flexbox } from '@lobehub/ui';
import { Avatar, Tag, Text, Tooltip } from '@lobehub/ui/base-ui';
import type { TableColumnsType } from 'antd';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncBoundary from '@/components/AsyncBoundary';
import AsyncError from '@/components/AsyncError';
import InlineTable from '@/components/InlineTable';
import TablePagination from '@/components/TablePagination';
import type {
  CottiPlatformAnalyticsAgentErrorItem,
  CottiPlatformAnalyticsAgentErrorSort,
} from '@/types/cotti/platformAnalytics';

import type { CottiPlatformAnalyticsDetailListState } from './detail';
import { DetailEmpty } from './DetailEmpty';
import { DetailTableSkeleton } from './DetailTableSkeleton';
import { DetailToolbar } from './DetailToolbar';
import { useCottiPlatformAnalyticsAgentErrors } from './hooks';
import type { CottiPlatformAnalyticsRangeSelection } from './range';
import { styles } from './style';

interface AgentErrorsTableProps {
  enabled: boolean;
  onPageChange: (page: number, pageSize: 20 | 50) => void;
  onQueryChange: (value: string) => void;
  onSortChange: (value: CottiPlatformAnalyticsAgentErrorSort) => void;
  range: CottiPlatformAnalyticsRangeSelection;
  state: CottiPlatformAnalyticsDetailListState<CottiPlatformAnalyticsAgentErrorSort>;
}

export const AgentErrorsTable = memo<AgentErrorsTableProps>(
  ({ enabled, onPageChange, onQueryChange, onSortChange, range, state }) => {
    const { t } = useTranslation('setting');
    const swr = useCottiPlatformAnalyticsAgentErrors(range, state, enabled);
    const data = swr.data;
    const hasQuery = Boolean(state.q.trim());
    const columns = useMemo<TableColumnsType<CottiPlatformAnalyticsAgentErrorItem>>(
      () => [
        {
          dataIndex: 'agentId',
          fixed: 'left',
          key: 'agent',
          render: (_value, record) => {
            const title = record.title || t('platformAnalytics.errors.agent.unattributed');

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
                      {t('platformAnalytics.errors.agent.identityMissing')}
                    </Text>
                  )}
                </Flexbox>
              </Flexbox>
            );
          },
          title: t('platformAnalytics.errors.columns.agent'),
          width: 300,
        },
        {
          dataIndex: 'category',
          key: 'category',
          render: (value) => {
            const category = value || t('platformAnalytics.errors.unclassified');

            return (
              <Tooltip title={category}>
                <Tag className={styles.errorCategory} size={'small'}>
                  {category}
                </Tag>
              </Tooltip>
            );
          },
          title: t('platformAnalytics.errors.columns.category'),
          width: 280,
        },
        {
          align: 'right',
          dataIndex: 'errorExecutions',
          key: 'errorExecutions',
          render: (value) => formatUsageValue(value),
          title: t('platformAnalytics.errors.columns.executionErrors'),
          width: 148,
        },
        {
          align: 'right',
          dataIndex: 'affectedUsers',
          key: 'affectedUsers',
          render: (value) => formatUsageValue(value),
          title: t('platformAnalytics.errors.columns.affectedUsers'),
          width: 140,
        },
      ],
      [t],
    );
    const sortOptions = useMemo(
      () =>
        [
          {
            label: t('platformAnalytics.errors.sort.executionErrors'),
            value: 'errorExecutions',
          },
          {
            label: t('platformAnalytics.errors.sort.affectedUsers'),
            value: 'affectedUsers',
          },
        ] satisfies Array<{ label: string; value: CottiPlatformAnalyticsAgentErrorSort }>,
      [t],
    );

    return (
      <>
        <DetailToolbar
          isRefreshing={swr.isValidating}
          placeholder={t('platformAnalytics.errors.agent.search')}
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
              emptyDescription={t('platformAnalytics.errors.agent.empty.desc')}
              emptyTitle={t('platformAnalytics.errors.agent.empty.title')}
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
          <InlineTable<CottiPlatformAnalyticsAgentErrorItem>
            columns={columns}
            dataSource={data?.items}
            rowKey={(record) => JSON.stringify([record.agentId, record.category])}
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

AgentErrorsTable.displayName = 'AgentErrorsTable';
