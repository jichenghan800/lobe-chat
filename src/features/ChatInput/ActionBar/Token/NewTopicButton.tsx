import { Flexbox } from '@lobehub/ui';
import { Button, Text, toast } from '@lobehub/ui/base-ui';
import { useTranslation } from 'react-i18next';

import { useActiveRouteParams } from '@/hooks/useActiveRouteParams';
import { usePermission } from '@/hooks/usePermission';
import { useQueryRoute } from '@/hooks/useQueryRoute';
import { useChatStore } from '@/store/chat';

import { useAgentId } from '../../hooks/useAgentId';
import { useChatInputResourceAccess } from '../../hooks/useChatInputResourceAccess';
import { useChatInputStore } from '../../store';
import { getTopicFreezeNotice } from './topicFreezeNotice';
import { useTopicContinuation } from './useTopicContinuation';
import { useTopicFreezeModal } from './useTopicFreezeModal';

export const NewTopicButton = () => {
  const { t } = useTranslation('chat');
  const router = useQueryRoute();
  const params = useActiveRouteParams();
  const agentId = useAgentId();
  const { allowed } = usePermission('create_content');
  const { canUseResource } = useChatInputResourceAccess();
  const frozen = useChatInputStore((s) => s.costFrozen);
  const freeze = useChatInputStore((s) => s.costFreeze);
  const notice = getTopicFreezeNotice(freeze);
  const generating = useChatInputStore((s) => s.sendButtonProps?.generating);
  const [topicId, threadId, groupId] = useChatStore((s) => [
    s.activeTopicId,
    s.activeThreadId,
    s.activeGroupId,
  ]);

  const { busy, cancel, open, progress } = useTopicContinuation(agentId, (path) =>
    router.push(path),
  );
  const start = async (carryProgress: boolean) => {
    try {
      await open(carryProgress);
    } catch (error) {
      console.error('[TopicContinuation]', error);
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        toast.error(t('longTopic.failed'));
    }
  };
  const visible = !!(
    frozen &&
    topicId &&
    freeze?.topicId === topicId &&
    !threadId &&
    !groupId &&
    agentId &&
    params.aid === agentId &&
    allowed &&
    canUseResource
  );
  const showFreeze = useTopicFreezeModal({
    content: t(notice.key, notice),
    enabled: visible && !generating && !busy && !!freeze,
    onContinue: () => {
      void start(false);
    },
    topicId,
  });
  if (!visible) return null;
  return (
    <Flexbox gap={4} style={{ minWidth: 0, maxWidth: '100%' }}>
      <Flexbox horizontal gap={4} wrap="wrap">
        <Button disabled={generating || busy} size="small" onClick={showFreeze}>
          {t('topicChoice.frozenTitle')}
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
