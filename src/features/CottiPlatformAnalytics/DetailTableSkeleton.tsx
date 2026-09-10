'use client';

import { Skeleton } from '@lobehub/ui/base-ui';
import type { TableColumnsType } from 'antd';
import { memo, useMemo } from 'react';

import InlineTable from '@/components/InlineTable';

interface DetailTableSkeletonProps {
  columns: Array<{ title: string; width?: number }>;
}

interface SkeletonRow {
  id: number;
}

const ROWS: SkeletonRow[] = Array.from({ length: 5 }, (_, id) => ({ id }));

export const DetailTableSkeleton = memo<DetailTableSkeletonProps>(({ columns }) => {
  const skeletonColumns = useMemo<TableColumnsType<SkeletonRow>>(
    () =>
      columns.map((column, index) => ({
        key: index,
        render: () => <Skeleton style={{ height: 14, width: index === 0 ? '72%' : '58%' }} />,
        title: column.title,
        width: column.width,
      })),
    [columns],
  );

  return <InlineTable<SkeletonRow> columns={skeletonColumns} dataSource={ROWS} rowKey={'id'} />;
});

DetailTableSkeleton.displayName = 'DetailTableSkeleton';
