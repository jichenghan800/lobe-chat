'use client';

import { formatNumber, formatUsageValue } from '@lobechat/utils';
import { ModelIcon } from '@lobehub/icons';
import { Flexbox, Icon } from '@lobehub/ui';
import { Text, Tooltip } from '@lobehub/ui/base-ui';
import type { TableColumnsType } from 'antd';
import { CircleHelpIcon } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncBoundary from '@/components/AsyncBoundary';
import AsyncError from '@/components/AsyncError';
import InlineTable from '@/components/InlineTable';
import TablePagination from '@/components/TablePagination';
import TotalToken from '@/components/TotalToken';
import type {
  CottiPlatformAnalyticsChatModelItem,
  CottiPlatformAnalyticsChatModelSort,
} from '@/types/cotti/platformAnalytics';

import type { CottiPlatformAnalyticsDetailListState } from './detail';
import { DetailEmpty } from './DetailEmpty';
import { DetailTableSkeleton } from './DetailTableSkeleton';
import { DetailToolbar } from './DetailToolbar';
import { useCottiPlatformAnalyticsChatModels } from './hooks';
import type { CottiPlatformAnalyticsRangeSelection } from './range';
import { styles } from './style';

interface ChatModelsTableProps {
  enabled: boolean;
  onPageChange: (page: number, pageSize: 20 | 50) => void;
  onQueryChange: (value: string) => void;
  onSortChange: (value: CottiPlatformAnalyticsChatModelSort) => void;
  range: CottiPlatformAnalyticsRangeSelection;
  state: CottiPlatformAnalyticsDetailListState<CottiPlatformAnalyticsChatModelSort>;
}

const formatCost = (value: number) => `$${formatNumber(value, value > 0 && value < 0.01 ? 4 : 2)}`;
const formatPercent = (value: number) => `${formatNumber(value * 100, 2)}%`;

export const ChatModelsTable = memo<ChatModelsTableProps>(
  ({ enabled, onPageChange, onQueryChange, onSortChange, range, state }) => {
    const { t } = useTranslation('setting');
    const swr = useCottiPlatformAnalyticsChatModels(range, state, enabled);
    const data = swr.data;
    const hasQuery = Boolean(state.q.trim());
    const columns = useMemo<TableColumnsType<CottiPlatformAnalyticsChatModelItem>>(
      () => [
        {
          dataIndex: 'model',
          fixed: 'left',
          key: 'model',
          render: (_value, record) => {
            const model = record.model || t('platformAnalytics.details.models.unattributed');
            const provider =
              record.provider || t('platformAnalytics.details.models.providerMissing');

            return (
              <Flexbox horizontal align={'center'} className={styles.detailIdentity} gap={10}>
                {record.model ? (
                  <ModelIcon model={record.model} size={28} />
                ) : (
                  <span className={styles.detailModelFallback}>
                    <Icon icon={CircleHelpIcon} size={16} />
                  </span>
                )}
                <Flexbox className={styles.detailIdentityCopy} gap={2}>
                  <Tooltip title={model}>
                    <Text ellipsis weight={500}>
                      {model}
                    </Text>
                  </Tooltip>
                  <Tooltip title={provider}>
                    <Text ellipsis fontSize={12} type={'secondary'}>
                      {provider}
                    </Text>
                  </Tooltip>
                </Flexbox>
              </Flexbox>
            );
          },
          title: t('platformAnalytics.details.columns.model'),
          width: 260,
        },
        {
          align: 'right',
          dataIndex: 'activeUsers',
          key: 'activeUsers',
          render: (value) => formatUsageValue(value),
          title: t('platformAnalytics.details.columns.activeUsers'),
          width: 112,
        },
        {
          align: 'right',
          dataIndex: 'assistantMessages',
          key: 'assistantMessages',
          render: (value) => formatUsageValue(value),
          title: t('platformAnalytics.details.columns.assistantMessages'),
          width: 120,
        },
        {
          dataIndex: 'totalTokens',
          key: 'totalTokens',
          render: (value, record) => (
            <TotalToken
              totalInputTokens={record.totalInputTokens}
              totalOutputTokens={record.totalOutputTokens}
              totalTokens={value}
            />
          ),
          title: t('platformAnalytics.details.columns.tokens'),
          width: 220,
        },
        {
          align: 'right',
          dataIndex: 'recordedCost',
          key: 'recordedCost',
          render: (value) => formatCost(value),
          title: t('platformAnalytics.details.columns.cost'),
          width: 112,
        },
        {
          align: 'right',
          dataIndex: 'errorMessages',
          key: 'errorMessages',
          render: (value, record) =>
            t('platformAnalytics.details.errors.value', {
              count: formatNumber(value),
              rate: formatPercent(record.errorRate),
            }),
          title: t('platformAnalytics.details.columns.errors'),
          width: 136,
        },
      ],
      [t],
    );
    const sortOptions = useMemo(
      () =>
        [
          {
            label: t('platformAnalytics.details.sort.totalTokens'),
            value: 'totalTokens',
          },
          {
            label: t('platformAnalytics.details.sort.activeUsers'),
            value: 'activeUsers',
          },
          {
            label: t('platformAnalytics.details.sort.assistantMessages'),
            value: 'assistantMessages',
          },
          {
            label: t('platformAnalytics.details.sort.recordedCost'),
            value: 'recordedCost',
          },
          {
            label: t('platformAnalytics.details.sort.errorMessages'),
            value: 'errorMessages',
          },
        ] satisfies Array<{ label: string; value: CottiPlatformAnalyticsChatModelSort }>,
      [t],
    );

    return (
      <>
        <DetailToolbar
          isRefreshing={swr.isValidating}
          placeholder={t('platformAnalytics.details.models.search')}
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
              emptyDescription={t('platformAnalytics.details.models.empty.desc')}
              emptyTitle={t('platformAnalytics.details.models.empty.title')}
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
          <InlineTable<CottiPlatformAnalyticsChatModelItem>
            columns={columns}
            dataSource={data?.items}
            rowKey={(record) => JSON.stringify([record.provider, record.model])}
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

ChatModelsTable.displayName = 'ChatModelsTable';
