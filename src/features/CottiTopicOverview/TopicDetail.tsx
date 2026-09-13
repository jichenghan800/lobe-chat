'use client';

import { Center, Empty, Flexbox, Icon } from '@lobehub/ui';
import { Tag, Text } from '@lobehub/ui/base-ui';
import { ImageIcon, MessageCircleIcon, TriangleAlertIcon } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useParams } from 'react-router';

import AsyncBoundary from '@/components/AsyncBoundary';
import SkeletonList from '@/features/Conversation/components/SkeletonList';
import BackButton from '@/features/NavPanel/components/BackButton';

import { useCottiTopicOverviewDetail } from './hooks';
import { ReadOnlyConversation } from './ReadOnlyConversation';
import { styles } from './style';
import { TopicManagement, TopicManagementHeader } from './TopicManagement';
import { TopicModeTag } from './TopicModeTag';

export const TopicDetail = memo(() => {
  const { i18n, t } = useTranslation('topic');
  const { topicId } = useParams<{ topicId: string }>();
  const location = useLocation();
  const swr = useCottiTopicOverviewDetail(topicId);
  const detail = swr.data;
  const [managementOpen, setManagementOpen] = useState(false);

  return (
    <AsyncBoundary
      data={detail}
      error={swr.error}
      isLoading={swr.isLoading}
      loading={<SkeletonList />}
      onRetry={() => void swr.mutate()}
    >
      {detail ? (
        <Flexbox className={styles.detail}>
          <Flexbox className={styles.detailHeader} gap={8}>
            <Flexbox horizontal align={'center'} gap={8}>
              <BackButton
                className={styles.mobileBack}
                title={t('overview.backToList')}
                to={`/overview${location.search}`}
              />
              <div className={styles.detailTitle} style={{ flex: 1, minWidth: 0 }}>
                {detail.title?.trim() || t('overview.untitled')}
              </div>
              <TopicManagementHeader
                topicId={detail.id}
                onOpen={() => setManagementOpen((open) => !open)}
              />
            </Flexbox>
            <Flexbox horizontal align={'center'} gap={8} wrap={'wrap'}>
              <TopicModeTag mode={detail.mode} />
              {(detail.userName || detail.userEmail || detail.targetTitle) && (
                <Text fontSize={12} type={'secondary'}>
                  {[detail.userName || detail.userEmail, detail.targetTitle]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              )}
              <Tag icon={<Icon icon={MessageCircleIcon} />}>
                {t('overview.messageCount', { count: detail.messageCount })}
              </Tag>
              {detail.imageCount > 0 && (
                <Tag icon={<Icon icon={ImageIcon} />}>
                  {t('overview.imageCount', { count: detail.imageCount })}
                </Tag>
              )}
              <Text fontSize={12} type={'secondary'}>
                {new Intl.DateTimeFormat(i18n.language, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(detail.updatedAt))}
              </Text>
            </Flexbox>
          </Flexbox>
          {detail.messagesTruncated && (
            <Flexbox horizontal align={'center'} className={styles.truncated} gap={8}>
              <Icon icon={TriangleAlertIcon} size={16} />
              <Text fontSize={12}>{t('overview.truncated')}</Text>
            </Flexbox>
          )}
          <Flexbox horizontal flex={1} style={{ minHeight: 0, position: 'relative' }}>
            <Flexbox className={styles.transcript} flex={1} style={{ minWidth: 0 }}>
              {detail.messages.length > 0 ? (
                <ReadOnlyConversation detail={detail} />
              ) : (
                <Center flex={1} padding={24}>
                  <Empty
                    description={t('overview.noMessagesDescription')}
                    title={t('overview.noMessagesTitle')}
                  />
                </Center>
              )}
            </Flexbox>
            {managementOpen && (
              <TopicManagement
                key={detail.id}
                topicId={detail.id}
                onClose={() => setManagementOpen(false)}
              />
            )}
          </Flexbox>
        </Flexbox>
      ) : null}
    </AsyncBoundary>
  );
});

TopicDetail.displayName = 'CottiTopicOverviewDetail';
