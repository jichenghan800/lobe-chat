'use client';

import { Center, Empty, Flexbox, SearchBar } from '@lobehub/ui';
import { Button, Text } from '@lobehub/ui/base-ui';
import {
  BotIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ListTodoIcon,
  MessageCircleIcon,
} from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useParams } from 'react-router';

import AsyncBoundary from '@/components/AsyncBoundary';
import AsyncError from '@/components/AsyncError';
import NavItem from '@/features/NavPanel/components/NavItem';
import { SkeletonList } from '@/features/NavPanel/components/SkeletonList';
import WorkspaceLink from '@/features/Workspace/WorkspaceLink';
import type { CottiTopicOverviewMode } from '@/types/cotti/topicOverview';

import { useCottiTopicOverviewList } from './hooks';
import { styles } from './style';
import { TopicModeTag } from './TopicModeTag';

const modeIcons = {
  agent: BotIcon,
  chat: MessageCircleIcon,
  task: ListTodoIcon,
} satisfies Record<CottiTopicOverviewMode, typeof BotIcon>;

export const TopicListPanel = memo(() => {
  const { i18n, t } = useTranslation('topic');
  const { topicId } = useParams<{ topicId: string }>();
  const location = useLocation();
  const { queryInput, setPage, setQueryInput, state, swr } = useCottiTopicOverviewList();
  const data = swr.data;
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / 50));
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' }),
    [i18n.language],
  );

  return (
    <Flexbox className={`overview-list-panel ${styles.listPanel}`}>
      <Flexbox className={styles.listHeader} gap={10}>
        <Flexbox horizontal align={'baseline'} justify={'space-between'} paddingInline={4}>
          <Text strong style={{ fontSize: 15 }}>
            {t('overview.title')}
          </Text>
          <Text fontSize={12} type={'secondary'}>
            {data ? t('overview.total', { count: data.total }) : undefined}
          </Text>
        </Flexbox>
        <SearchBar
          allowClear
          maxLength={100}
          placeholder={t('overview.searchPlaceholder')}
          value={queryInput}
          variant={'filled'}
          onInputChange={setQueryInput}
        />
      </Flexbox>

      {data && swr.error && (
        <AsyncError error={swr.error} variant={'inline'} onRetry={() => void swr.mutate()} />
      )}

      <Flexbox className={styles.listBody} flex={1}>
        <AsyncBoundary
          data={data}
          error={swr.error}
          isEmpty={!swr.error && data?.items.length === 0}
          isLoading={swr.isLoading}
          loading={<SkeletonList rows={8} style={{ paddingBlock: 6, paddingInline: 8 }} />}
          empty={
            <Center flex={1} gap={12} padding={24}>
              <Empty
                title={state.q ? t('overview.searchEmptyTitle') : t('overview.emptyTitle')}
                description={
                  state.q ? t('overview.searchEmptyDesc') : t('overview.emptyDescription')
                }
              />
              {state.q && (
                <Button size={'small'} onClick={() => setQueryInput('')}>
                  {t('overview.clearSearch')}
                </Button>
              )}
            </Center>
          }
          onRetry={() => void swr.mutate()}
        >
          <div className={styles.list}>
            {data?.items.map((item) => {
              const title = item.title?.trim() || t('overview.untitled');
              const description = [item.userName || item.userEmail, item.targetTitle]
                .filter(Boolean)
                .join(' · ');
              const href = `/overview/${item.id}${location.search}`;

              return (
                <WorkspaceLink key={item.id} to={href}>
                  <NavItem
                    active={item.id === topicId}
                    icon={modeIcons[item.mode]}
                    title={title}
                    description={
                      <Flexbox horizontal align={'center'} gap={4} style={{ minWidth: 0 }}>
                        <TopicModeTag mode={item.mode} />
                        {description && (
                          <Text
                            ellipsis={{ tooltipWhenOverflow: true }}
                            fontSize={12}
                            style={{ flex: 1, minWidth: 0 }}
                            type={'secondary'}
                          >
                            {description}
                          </Text>
                        )}
                      </Flexbox>
                    }
                    extra={
                      <Text fontSize={11} type={'secondary'}>
                        {dateFormatter.format(new Date(item.updatedAt))}
                      </Text>
                    }
                  />
                </WorkspaceLink>
              );
            })}
          </div>
        </AsyncBoundary>
      </Flexbox>

      {data && data.total > 0 && (
        <Flexbox
          horizontal
          align={'center'}
          className={styles.pagination}
          justify={'space-between'}
        >
          <Button
            aria-label={t('overview.previousPage')}
            disabled={state.page <= 1}
            icon={ChevronLeftIcon}
            size={'small'}
            type={'text'}
            onClick={() => setPage(state.page - 1)}
          />
          <Text fontSize={12} type={'secondary'}>
            {t('overview.page', { page: state.page, pages: pageCount })}
          </Text>
          <Button
            aria-label={t('overview.nextPage')}
            disabled={state.page >= pageCount}
            icon={ChevronRightIcon}
            size={'small'}
            type={'text'}
            onClick={() => setPage(state.page + 1)}
          />
        </Flexbox>
      )}
    </Flexbox>
  );
});

TopicListPanel.displayName = 'CottiTopicOverviewListPanel';
