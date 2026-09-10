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
import TotalToken from '@/components/TotalToken';
import type {
  CottiPlatformAnalyticsChatUserItem,
  CottiPlatformAnalyticsChatUserSort,
} from '@/types/cotti/platformAnalytics';

import type { CottiPlatformAnalyticsDetailListState } from './detail';
import { DetailEmpty } from './DetailEmpty';
import { DetailTableSkeleton } from './DetailTableSkeleton';
import { DetailToolbar } from './DetailToolbar';
import { useCottiPlatformAnalyticsChatUsers } from './hooks';
import type { CottiPlatformAnalyticsRangeSelection } from './range';
import { styles } from './style';

interface ChatUsersTableProps {
  enabled: boolean;
  onPageChange: (page: number, pageSize: 20 | 50) => void;
  onQueryChange: (value: string) => void;
  onSortChange: (value: CottiPlatformAnalyticsChatUserSort) => void;
  range: CottiPlatformAnalyticsRangeSelection;
  state: CottiPlatformAnalyticsDetailListState<CottiPlatformAnalyticsChatUserSort>;
}

const formatCost = (value: number) => `$${formatNumber(value, value > 0 && value < 0.01 ? 4 : 2)}`;
const formatPercent = (value: number) => `${formatNumber(value * 100, 2)}%`;

export const ChatUsersTable = memo<ChatUsersTableProps>(
  ({ enabled, onPageChange, onQueryChange, onSortChange, range, state }) => {
    const { i18n, t } = useTranslation('setting');
    const swr = useCottiPlatformAnalyticsChatUsers(range, state, enabled);
    const data = swr.data;
    const hasQuery = Boolean(state.q.trim());
    const columns = useMemo<TableColumnsType<CottiPlatformAnalyticsChatUserItem>>(
      () => [
        {
          dataIndex: 'userId',
          fixed: 'left',
          key: 'user',
          render: (_value, record) => {
            const name =
              record.fullName ||
              record.username ||
              record.email ||
              t('platformAnalytics.details.users.unnamed');
            const metadata = [record.username, record.email]
              .filter(
                (value, index, values) =>
                  value && value !== name && values.indexOf(value) === index,
              )
              .join(' · ');

            return (
              <Flexbox horizontal align={'center'} className={styles.detailIdentity} gap={10}>
                <Avatar avatar={record.avatar || name} size={28} />
                <Flexbox className={styles.detailIdentityCopy} gap={2}>
                  <Tooltip title={name}>
                    <Text ellipsis weight={500}>
                      {name}
                    </Text>
                  </Tooltip>
                  {metadata && (
                    <Tooltip title={metadata}>
                      <Text ellipsis fontSize={12} type={'secondary'}>
                        {metadata}
                      </Text>
                    </Tooltip>
                  )}
                </Flexbox>
              </Flexbox>
            );
          },
          title: t('platformAnalytics.details.columns.user'),
          width: 260,
        },
        {
          align: 'right',
          dataIndex: 'userMessages',
          key: 'userMessages',
          render: (value) => formatUsageValue(value),
          title: t('platformAnalytics.details.columns.userMessages'),
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
          align: 'right',
          dataIndex: 'activeDays',
          key: 'activeDays',
          render: (value) => formatNumber(value),
          title: t('platformAnalytics.details.columns.activeDays'),
          width: 100,
        },
        {
          align: 'right',
          dataIndex: 'activeTopics',
          key: 'activeTopics',
          render: (value) => formatUsageValue(value),
          title: t('platformAnalytics.details.columns.activeTopics'),
          width: 112,
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
        {
          dataIndex: 'lastActiveAt',
          key: 'lastActiveAt',
          render: (value) =>
            value
              ? new Intl.DateTimeFormat(i18n.language, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: data?.period.timezone ?? 'Asia/Shanghai',
                }).format(new Date(value))
              : t('platformAnalytics.details.users.noActiveTime'),
          title: t('platformAnalytics.details.columns.lastActiveAt'),
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
          {
            label: t('platformAnalytics.details.sort.lastActiveAt'),
            value: 'lastActiveAt',
          },
        ] satisfies Array<{ label: string; value: CottiPlatformAnalyticsChatUserSort }>,
      [t],
    );

    return (
      <>
        <DetailToolbar
          isRefreshing={swr.isValidating}
          placeholder={t('platformAnalytics.details.users.search')}
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
              emptyDescription={t('platformAnalytics.details.users.empty.desc')}
              emptyTitle={t('platformAnalytics.details.users.empty.title')}
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
          <InlineTable<CottiPlatformAnalyticsChatUserItem>
            columns={columns}
            dataSource={data?.items}
            rowKey={'userId'}
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

ChatUsersTable.displayName = 'ChatUsersTable';
