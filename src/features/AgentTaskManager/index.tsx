import { memo, useEffect, useState } from 'react';

import { PortalContent } from '@/features/Portal/router';
import RightPanel from '@/features/RightPanel';
import { useChatStore } from '@/store/chat';
import { chatPortalSelectors } from '@/store/chat/selectors';
import { PortalViewType } from '@/store/chat/slices/portal/initialState';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';

import Conversation from './Conversation';
import { TaskAgentProvider } from './TaskAgentProvider';

interface AgentTaskManagerProps {
  preferredAgentId?: string;
  viewedTaskId?: string;
}

const AgentTaskManager = memo<AgentTaskManagerProps>(({ preferredAgentId, viewedTaskId }) => {
  const [expand, toggleTaskAgentPanel] = useGlobalStore((s) => [
    systemStatusSelectors.showTaskAgentPanel(s),
    s.toggleTaskAgentPanel,
  ]);
  const portalView = useChatStore(chatPortalSelectors.currentViewType);
  const showAcceptance =
    portalView === PortalViewType.Acceptance || portalView === PortalViewType.AcceptanceCheck;
  const [hasOpened, setHasOpened] = useState(false);

  useEffect(() => {
    if (expand) setHasOpened(true);
  }, [expand]);

  // Defer initial setup, then retain the selected agent, draft and live conversation on collapse.
  const shouldMountContent = expand || hasOpened;

  return (
    <RightPanel
      defaultWidth={420}
      expand={expand}
      maxWidth={720}
      minWidth={320}
      width={portalView === PortalViewType.AcceptanceCheck ? 640 : undefined}
      onExpandChange={(next) => toggleTaskAgentPanel(next)}
    >
      {shouldMountContent &&
        (showAcceptance ? (
          <PortalContent />
        ) : (
          <TaskAgentProvider preferredAgentId={preferredAgentId} viewedTaskId={viewedTaskId}>
            <Conversation />
          </TaskAgentProvider>
        ))}
    </RightPanel>
  );
});

AgentTaskManager.displayName = 'AgentTaskManager';

export default AgentTaskManager;
