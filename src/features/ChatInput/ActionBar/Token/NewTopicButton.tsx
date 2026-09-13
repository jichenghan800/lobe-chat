import { Flexbox } from '@lobehub/ui';
import { Button, Text, toast } from '@lobehub/ui/base-ui';
import { useTranslation } from 'react-i18next';

import { useActiveRouteParams } from '@/hooks/useActiveRouteParams';
import { usePermission } from '@/hooks/usePermission';
import { useQueryRoute } from '@/hooks/useQueryRoute';
import { useChatStore } from '@/store/chat';
import { displayMessageSelectors } from '@/store/chat/selectors';

import { useAgentId } from '../../hooks/useAgentId';
import { useChatInputResourceAccess } from '../../hooks/useChatInputResourceAccess';
import { useChatInputStore } from '../../store';
import { chooseTopic } from './topicChoiceModal';
import { useTopicContinuation } from './useTopicContinuation';

export const NewTopicButton = () => {
  const { t } = useTranslation('chat');
  const router = useQueryRoute();
  const params = useActiveRouteParams();
  const agentId = useAgentId();
  const { allowed } = usePermission('create_content');
  const { canUseResource } = useChatInputResourceAccess();
  const hasHistory = useChatStore(
    (s) => displayMessageSelectors.activeDisplayMessages(s).length > 0,
  );
  const frozen = useChatInputStore((s) => s.costFrozen);
  const generating = useChatInputStore((s) => s.sendButtonProps?.generating);
  const [topicId, threadId, groupId] = useChatStore((s) => [
    s.activeTopicId,
    s.activeThreadId,
    s.activeGroupId,
  ]);

  const { busy, cancel, open, progress } = useTopicContinuation(agentId, (path) =>
    router.push(path),
  );
  if (
    !frozen ||
    !topicId ||
    (!hasHistory && !frozen) ||
    threadId ||
    groupId ||
    !agentId ||
    params.aid !== agentId ||
    !allowed ||
    !canUseResource
  )
    return null;
  const start = async (carryProgress: boolean) => {
    try {
      await open(carryProgress);
    } catch (error) {
      console.error('[TopicContinuation]', error);
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        toast.error(t('longTopic.failed'));
    }
  };
  return (
    <Flexbox gap={4} style={{ minWidth: 0, maxWidth: '100%' }}>
      {frozen && <Text role="status">{t('longTopic.frozen')}</Text>}
      <Flexbox horizontal gap={4} wrap="wrap">
        <Button
          disabled={generating || busy}
          size="small"
          onClick={async () => {
            const choice = await chooseTopic(true);
            if (choice !== 'cancel') await start(choice === 'current');
          }}
        >
          {t('topicChoice.frozenAction')}
        </Button>
        {busy && (
          <Button size="small" onClick={cancel}>
            {t('longTopic.cancel')}
          </Button>
        )}
      </Flexbox>
      {busy && <Text>{progress || t('longTopic.preparing')}</Text>}
    </Flexbox>
  );
};
