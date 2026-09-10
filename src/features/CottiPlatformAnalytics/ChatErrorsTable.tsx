'use client';

import { formatUsageValue } from '@lobechat/utils';
import { ModelIcon } from '@lobehub/icons';
import { Flexbox, Icon } from '@lobehub/ui';
import { Tag, Text, Tooltip } from '@lobehub/ui/base-ui';
import type { TableColumnsType } from 'antd';
import { CircleHelpIcon } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncBoundary from '@/components/AsyncBoundary';
import AsyncError from '@/components/AsyncError';
import InlineTable from '@/components/InlineTable';
import TablePagination from '@/components/TablePagination';
import type {
  CottiPlatformAnalyticsChatErrorItem,
  CottiPlatformAnalyticsChatErrorSort,
} from '@/types/cotti/platformAnalytics';

import type { CottiPlatformAnalyticsDetailListState } from './detail';
import { DetailEmpty } from './DetailEmpty';
import { DetailTableSkeleton } from './DetailTableSkeleton';
import { DetailToolbar } from './DetailToolbar';
import { useCottiPlatformAnalyticsChatErrors } from './hooks';
import type { CottiPlatformAnalyticsRangeSelection } from './range';
import { styles } from './style';

interface ChatErrorsTableProps {
  enabled: boolean;
  onPageChange: (page: number, pageSize: 20 | 50) => void;
  onQueryChange: (value: string) => void;
  onSortChange: (value: CottiPlatformAnalyticsChatErrorSort) => void;
  range: CottiPlatformAnalyticsRangeSelection;
  state: CottiPlatformAnalyticsDetailListState<CottiPlatformAnalyticsChatErrorSort>;
}

export const ChatErrorsTable = memo<ChatErrorsTableProps>(
  ({ enabled, onPageChange, onQueryChange, onSortChange, range, state }) => {
    const { t } = useTranslation('setting');
    const swr = useCottiPlatformAnalyticsChatErrors(range, state, enabled);
    const data = swr.data;
    const hasQuery = Boolean(state.q.trim());
    const columns = useMemo<TableColumnsType<CottiPlatformAnalyticsChatErrorItem>>(
      () => [
        {
          dataIndex: 'category',
          fixed: 'left',
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
          width: 260,
        },
        {
          dataIndex: 'model',
          key: 'model',
          render: (_value, record) => {
            const model = record.model || t('platformAnalytics.errors.chat.modelMissing');
            const provider = record.provider || t('platformAnalytics.errors.chat.providerMissing');

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
          title: t('platformAnalytics.errors.columns.model'),
          width: 280,
        },
        {
          align: 'right',
          dataIndex: 'errorMessages',
          key: 'errorMessages',
          render: (value) => formatUsageValue(value),
          title: t('platformAnalytics.errors.columns.replyErrors'),
          width: 140,
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
            label: t('platformAnalytics.errors.sort.replyErrors'),
            value: 'errorMessages',
          },
          {
            label: t('platformAnalytics.errors.sort.affectedUsers'),
            value: 'affectedUsers',
          },
        ] satisfies Array<{ label: string; value: CottiPlatformAnalyticsChatErrorSort }>,
      [t],
    );

    return (
      <>
        <DetailToolbar
          isRefreshing={swr.isValidating}
          placeholder={t('platformAnalytics.errors.chat.search')}
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
              emptyDescription={t('platformAnalytics.errors.chat.empty.desc')}
              emptyTitle={t('platformAnalytics.errors.chat.empty.title')}
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
          <InlineTable<CottiPlatformAnalyticsChatErrorItem>
            columns={columns}
            dataSource={data?.items}
            rowKey={(record) => JSON.stringify([record.provider, record.model, record.category])}
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

ChatErrorsTable.displayName = 'ChatErrorsTable';
