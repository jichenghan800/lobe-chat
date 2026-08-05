import { FilesTabs } from '@lobechat/types';
import { Center, Empty, Flexbox, SearchBar } from '@lobehub/ui';
import { useDebounce } from 'ahooks';
import { FileSearchIcon } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Virtuoso } from 'react-virtuoso';

import AsyncBoundary from '@/components/AsyncBoundary';
import { useFileStore } from '@/store/file';

import FileRow from './FileRow';

const FILE_PICKER_LIMIT = 100;

const List = memo(() => {
  const { t } = useTranslation('chat');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, { wait: 300 });
  const useFetchKnowledgeItems = useFileStore((s) => s.useFetchKnowledgeItems);
  const { data, error, isLoading, mutate } = useFetchKnowledgeItems({
    category: FilesTabs.All,
    limit: FILE_PICKER_LIMIT,
    q: debouncedQuery,
    showFilesInKnowledgeBase: true,
    sorter: 'createdAt',
    sortType: 'desc',
  });

  const files = data?.filter((item) => item.sourceType === 'file') ?? [];

  return (
    <Flexbox gap={12} height={500} width={'100%'}>
      <SearchBar
        allowClear
        placeholder={t('attachment.searchPlaceholder')}
        value={query}
        variant={'filled'}
        onInputChange={setQuery}
      />
      <AsyncBoundary
        data={data}
        error={error}
        isEmpty={!error && files.length === 0}
        isLoading={isLoading}
        empty={
          <Center height={'100%'} padding={40}>
            <Empty
              description={t(query ? 'attachment.searchEmpty' : 'attachment.empty')}
              icon={FileSearchIcon}
            />
          </Center>
        }
        onRetry={() => {
          void mutate();
        }}
      >
        <Virtuoso
          data={files}
          itemContent={(_, item) => <FileRow item={item} />}
          style={{ flex: 1 }}
        />
      </AsyncBoundary>
    </Flexbox>
  );
});

List.displayName = 'SendFilesList';

export default List;
