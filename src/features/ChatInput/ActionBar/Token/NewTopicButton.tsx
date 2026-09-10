import { Button, toast } from '@lobehub/ui/base-ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useActiveRouteParams } from '@/hooks/useActiveRouteParams';
import { usePermission } from '@/hooks/usePermission';
import { useQueryRoute } from '@/hooks/useQueryRoute';
import { useChatStore } from '@/store/chat';

import { useAgentId } from '../../hooks/useAgentId';
import { useChatInputResourceAccess } from '../../hooks/useChatInputResourceAccess';
import { useChatInputStore } from '../../store';

export const NewTopicButton = () => {
  const { t } = useTranslation('chat');
  const router = useQueryRoute();
  const params = useActiveRouteParams();
  const agentId = useAgentId();
  const { allowed } = usePermission('create_content');
  const { canUseResource } = useChatInputResourceAccess();
  const generating = useChatInputStore((s) => s.sendButtonProps?.generating);
  const [topicId, threadId, groupId, switchTopic] = useChatStore((s) => [
    s.activeTopicId,
    s.activeThreadId,
    s.activeGroupId,
    s.switchTopic,
  ]);
  const [busy, setBusy] = useState(false);
  // Only the main Agent conversation owns this navigation. Embedded composers stay in place.
  if (
    !topicId ||
    threadId ||
    groupId ||
    !agentId ||
    params.aid !== agentId ||
    !allowed ||
    !canUseResource
  )
    return null;
  return (
    <Button
      disabled={generating || busy}
      loading={busy}
      size="small"
      onClick={async () => {
        setBusy(true);
        try {
          await switchTopic(null);
          router.push(`/agent/${encodeURIComponent(agentId)}`);
        } catch (error) {
          console.error('[NewTopicButton]', error);
          toast.error(t('longTopic.failed'));
        } finally {
          setBusy(false);
        }
      }}
    >
      {t('longTopic.newTopic')}
    </Button>
  );
};
