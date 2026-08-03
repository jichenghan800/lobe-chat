'use client';

import { Flexbox, SearchBar, Text } from '@lobehub/ui';
import { Button, Select } from '@lobehub/ui/base-ui';
import { RefreshCwIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { styles } from './style';

interface DetailToolbarProps<TSort extends string> {
  isRefreshing: boolean;
  kind: 'agents' | 'models' | 'users';
  onQueryChange: (value: string) => void;
  onRefresh: () => void;
  onSortChange: (value: TSort) => void;
  query: string;
  sortBy: TSort;
  sortOptions: Array<{ label: string; value: TSort }>;
}

const DetailToolbarInner = <TSort extends string>({
  isRefreshing,
  kind,
  onQueryChange,
  onRefresh,
  onSortChange,
  query,
  sortBy,
  sortOptions,
}: DetailToolbarProps<TSort>) => {
  const { t } = useTranslation('setting');

  return (
    <Flexbox
      horizontal
      align={'center'}
      className={styles.detailToolbar}
      gap={12}
      justify={'space-between'}
      wrap={'wrap'}
    >
      <SearchBar
        allowClear
        className={styles.detailSearch}
        maxLength={100}
        placeholder={t(`platformAnalytics.details.${kind}.search` as const)}
        value={query}
        variant={'filled'}
        onInputChange={onQueryChange}
      />
      <Flexbox horizontal align={'center'} gap={8} wrap={'wrap'}>
        <Text fontSize={13} type={'secondary'}>
          {t('platformAnalytics.details.sort.label')}
        </Text>
        <Select
          className={styles.detailSort}
          options={sortOptions}
          size={'small'}
          value={sortBy}
          onChange={(value) => value && onSortChange(value as TSort)}
        />
        <Button
          icon={RefreshCwIcon}
          loading={isRefreshing}
          size={'small'}
          type={'text'}
          onClick={onRefresh}
        >
          {t('platformAnalytics.refresh')}
        </Button>
      </Flexbox>
    </Flexbox>
  );
};

export const DetailToolbar = memo(DetailToolbarInner) as typeof DetailToolbarInner;
