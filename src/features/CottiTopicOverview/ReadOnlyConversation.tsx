'use client';

import { Flexbox, Text } from '@lobehub/ui';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { ChatList, ConversationProvider, MessageItem } from '@/features/Conversation';
import type { CottiTopicOverviewDetail } from '@/types/cotti/topicOverview';

interface ReadOnlyConversationProps {
  detail: CottiTopicOverviewDetail;
}

export const ReadOnlyConversation = memo<ReadOnlyConversationProps>(({ detail }) => {
  const { t } = useTranslation('topic');
  const context = useMemo(
    () => ({
      agentId: detail.agentId ?? `overview-${detail.id}`,
      groupId: detail.groupId ?? undefined,
      topicId: detail.id,
      topicShareId: `admin-overview-${detail.id}`,
    }),
    [detail.agentId, detail.groupId, detail.id],
  );
  const itemContent = useCallback(
    (index: number, id: string) => <MessageItem disableEditing id={id} index={index} key={id} />,
    [],
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
