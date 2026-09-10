import { Flexbox } from '@lobehub/ui';
import { Skeleton } from '@lobehub/ui/base-ui';
import { createStaticStyles } from 'antd-style';
import { memo } from 'react';

import ChatInputCredits from '@/business/client/features/ChatInputCredits';
import { useAgentStore } from '@/store/agent';
import { agentByIdSelectors } from '@/store/agent/selectors';

import ContextWindow from '../ActionBar/Token';
import { useAgentId } from '../hooks/useAgentId';
import { useChatInputResourceAccess } from '../hooks/useChatInputResourceAccess';
import { useEffectiveAgentMode } from '../hooks/useEffectiveAgentMode';
import { useChatInputStore } from '../store';
import ApprovalMode from './ApprovalMode';
import ModeSelector from './ModeSelector';
import WorkspaceControls from './WorkspaceControls';

const styles = createStaticStyles(({ css }) => ({
  // Keep compact controls at least 28px tall, but reserve space for cost guidance.
  bar: css`
    flex: none;
    flex-wrap: wrap;
    row-gap: 4px;

    height: auto;
    min-height: 28px;
    padding-block: 0;
    padding-inline: 4px;
  `,
  // Left cluster (mode + device + working directory + git) is the variable-width
  // part. It shrinks first and, once its long labels have truncated as far as
  // they can, scrolls horizontally instead of wrapping each chip's text. The
  // scrollbar is hidden — trackpad / wheel still works.
  leftGroup: css`
    scrollbar-width: none;
    overflow: auto hidden;
    flex: 1 1 120px;
    min-width: 0;

    &::-webkit-scrollbar {
      display: none;
    }
  `,
  // Guidance wraps within the composer on narrow screens.
  rightGroup: css`
    flex: none;
    flex-wrap: wrap;
    min-width: 0;
    max-width: 100%;
  `,
}));

const ControlBar = memo(() => {
  const agentId = useAgentId();
  const { canShowControls } = useChatInputResourceAccess();
  const showContextWindow = useChatInputStore((s) =>
    s.rightActions.flat().includes('contextWindow'),
  );

  const isLoading = useAgentStore((s) => agentByIdSelectors.isAgentConfigLoadingById(agentId)(s));
  const { isAgentRuntimeMode, isPreferenceLoading } = useEffectiveAgentMode(agentId);

  if (!canShowControls || isPreferenceLoading) return null;

  // Skeleton placeholder to prevent layout jump during loading
  if (!agentId || isLoading) {
    return (
      <Flexbox horizontal align={'center'} className={styles.bar} gap={4}>
        <Skeleton style={{ height: 22, minWidth: 64, width: 64 }} />
        <Skeleton style={{ height: 22, minWidth: 100, width: 100 }} />
      </Flexbox>
    );
  }

  return (
    <Flexbox horizontal align={'center'} className={styles.bar} justify={'space-between'}>
      {/* Left: chat-mode switcher + (agent-only) execution device + working directory */}
      <Flexbox horizontal align={'center'} className={styles.leftGroup} gap={4}>
        <ModeSelector />
        {isAgentRuntimeMode && <WorkspaceControls agentId={agentId} />}
      </Flexbox>

      <Flexbox horizontal align={'center'} className={styles.rightGroup} gap={4}>
        <ChatInputCredits />
        {isAgentRuntimeMode && <ApprovalMode />}
        {showContextWindow && <ContextWindow />}
      </Flexbox>
    </Flexbox>
  );
});

ControlBar.displayName = 'ControlBar';

export default ControlBar;
