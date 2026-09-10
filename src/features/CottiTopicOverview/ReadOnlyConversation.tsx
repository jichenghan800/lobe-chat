'use client';

import { Flexbox } from '@lobehub/ui';
import { Text } from '@lobehub/ui/base-ui';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { ChatList, ConversationProvider, MessageItem } from '@/features/Conversation';
import { dataSelectors, useConversationStore } from '@/features/Conversation/store';
import type { CottiTopicOverviewDetail } from '@/types/cotti/topicOverview';

import { getOverviewMessageModels } from './messageModels';
import { styles } from './style';
import { buildOverviewTurnTimeMap } from './turnTime';

interface ReadOnlyConversationProps {
  detail: CottiTopicOverviewDetail;
}

const ActualMessageModels = memo<{ id: string }>(({ id }) => {
  const { t } = useTranslation('topic');
  const message = useConversationStore(dataSelectors.getDisplayMessageById(id));
  const sourceMessages = useConversationStore(dataSelectors.dbMessages);
  const models = message ? getOverviewMessageModels(message, sourceMessages) : [];
  if (!models.length) return null;
  return (
    <Flexbox paddingBlock={4} paddingInline={24}>
      <Text fontSize={12} style={{ overflowWrap: 'anywhere' }} type={'secondary'}>
        {t('overview.actualModels', {
          models: models.map((model) => model || t('overview.modelNotRecorded')).join(' · '),
        })}
      </Text>
    </Flexbox>
  );
});
ActualMessageModels.displayName = 'ActualMessageModels';

export const ReadOnlyConversation = memo<ReadOnlyConversationProps>(({ detail }) => {
  const { i18n, t } = useTranslation('topic');
  const context = useMemo(
    () => ({
      agentId: detail.agentId ?? `overview-${detail.id}`,
      groupId: detail.groupId ?? undefined,
      topicId: detail.id,
      topicShareId: `admin-overview-${detail.id}`,
    }),
    [detail.agentId, detail.groupId, detail.id],
  );
  const turnTimeMap = useMemo(
    () => buildOverviewTurnTimeMap(detail.messages, i18n.language),
    [detail.messages, i18n.language],
  );
  const itemContent = useCallback(
    (index: number, id: string) => {
      const turnTime = turnTimeMap.get(id);

      return (
        <Flexbox key={id}>
          {turnTime && (
            <Flexbox horizontal align={'center'} className={styles.turnTime} gap={12}>
              <span aria-hidden className={styles.turnTimeLine} />
              <time dateTime={turnTime.dateTime}>
                {t('overview.questionTime', { time: turnTime.label })}
              </time>
              <span aria-hidden className={styles.turnTimeLine} />
            </Flexbox>
          )}
          <ActualMessageModels id={id} />
          <MessageItem disableEditing id={id} index={index} />
        </Flexbox>
      );
    },
    [t, turnTimeMap],
  );

  return (
    <ConversationProvider hasInitMessages skipFetch context={context} messages={detail.messages}>
      <ChatList
        disableActionsBar
        itemContent={itemContent}
        footerSlot={
          <Flexbox align={'center'} paddingBlock={'16px 48px'} paddingInline={24}>
            <Text fontSize={12} style={{ maxWidth: 560, textAlign: 'center' }} type={'secondary'}>
              {t('overview.attachmentNotice')}
            </Text>
          </Flexbox>
        }
      />
    </ConversationProvider>
  );
});

ReadOnlyConversation.displayName = 'CottiTopicOverviewReadOnlyConversation';
