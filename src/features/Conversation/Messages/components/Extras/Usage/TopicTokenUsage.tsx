import { Tooltip } from '@lobehub/ui';
import { Text } from '@lobehub/ui/base-ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { useClientDataSWR } from '@/libs/swr';
import { topicService } from '@/services/topic';
import { formatNumber } from '@/utils/format';

import { useConversationStore } from '../../../../store';
import { getMessageTokenTotal, getTopicTokenTotal, readSettledTopicUsage } from './topicTokenUsage';

/** Mount data subscriptions only for the latest completed answer, not every historical row. */
const TopicTokenUsage = memo<{ messageId: string }>(({ messageId }) => {
  const topicId = useConversationStore((s) =>
    s.context.topicId &&
    !s.context.topicShareId &&
    !s.context.threadId &&
    s.displayMessages.at(-1)?.id === messageId &&
    !s.operationState.isAIGenerating
      ? s.context.topicId
      : undefined,
  );
  return topicId ? <TopicTokenTotal topicId={topicId} /> : null;
});

const TopicTokenTotal = memo<{ topicId: string }>(({ topicId }) => {
  const { t, i18n } = useTranslation('chat');
  const revision = useConversationStore((s) => {
    const last = s.dbMessages.at(-1);
    return `${last?.id}:${last?.updatedAt}:${last?.usage?.totalTokens}:${s.dbMessages.length}`;
  });
  const knownTokens = useConversationStore((s) =>
    s.dbMessages.reduce(
      (total, message) =>
        total + (message.role === 'assistant' ? (getMessageTokenTotal(message) ?? 0) : 0),
      0,
    ),
  );
  const { data, error, isLoading } = useClientDataSWR(
    ['cotti-topic-token-total', topicId, revision, knownTokens],
    () => readSettledTopicUsage(() => topicService.getTopicDetail(topicId), knownTokens),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  const total = getTopicTokenTotal(data);
  const formatted =
    total === undefined
      ? undefined
      : new Intl.NumberFormat(i18n.language, {
          notation: 'compact',
          maximumFractionDigits: 2,
        }).format(total);
  const title =
    total === undefined
      ? t('messages.topicTokens.unavailableHint')
      : t('messages.topicTokens.hint', {
          total: formatNumber(total),
          input: data?.totalInputTokens == null ? '—' : formatNumber(data.totalInputTokens),
          output: data?.totalOutputTokens == null ? '—' : formatNumber(data.totalOutputTokens),
        });
  return (
    <Tooltip title={title}>
      <Text
        data-testid={'topic-token-total'}
        fontSize={12}
        style={{ overflowWrap: 'anywhere' }}
        type={'secondary'}
      >
        {isLoading
          ? t('messages.topicTokens.loading')
          : error || total === undefined
            ? t('messages.topicTokens.unavailable')
            : t('messages.topicTokens.total', { value: formatted })}
      </Text>
    </Tooltip>
  );
});
TopicTokenTotal.displayName = 'TopicTokenTotal';
TopicTokenUsage.displayName = 'TopicTokenUsage';
export default TopicTokenUsage;
