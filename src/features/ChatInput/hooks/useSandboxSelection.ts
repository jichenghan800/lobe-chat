import type { TopicSandboxProvider } from '@lobechat/types';
import { confirmModal, toast } from '@lobehub/ui/base-ui';
import { useRef, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';

import { useChatInputStore } from '@/features/ChatInput/store';
import { useClientDataSWR } from '@/libs/swr';
import { cottiSandboxService } from '@/services/cottiSandbox';
import { useChatStore } from '@/store/chat';
import {
  getPendingSandboxProvider,
  setPendingSandboxProvider,
  subscribePendingSandboxProvider,
} from '@/store/chat/pendingSandboxProvider';
import { operationSelectors, topicSelectors } from '@/store/chat/selectors';

export const useSandboxSelection = (agentId: string, enableExecution: () => Promise<boolean>) => {
  const selecting = useRef(false);
  const { t } = useTranslation('chat');
  const topicScope = useChatInputStore((s) => s.topicModelScope);
  const topicId = useChatStore((s) =>
    topicScope && s.activeAgentId === agentId ? s.activeTopicId : undefined,
  );
  const metadata = useChatStore(topicSelectors.currentTopicMetadata);
  const running = useChatStore(operationSelectors.isTopicVisiblyRunning(topicId ?? ''));
  const refreshTopic = useChatStore((s) => s.refreshTopic);
  const switchTopic = useChatStore((s) => s.switchTopic);
  const pending = useSyncExternalStore(
    subscribePendingSandboxProvider,
    () => getPendingSandboxProvider(agentId),
    () => 'market' as const,
  );
  const { data } = useClientDataSWR(
    ['cotti', 'sandbox-availability'],
    cottiSandboxService.getAvailability,
  );
  const provider = topicId ? (metadata?.sandboxProvider ?? 'market') : pending;

  const select = async (next: TopicSandboxProvider) => {
    if (selecting.current) return;
    if (running) {
      toast.error(t('heteroAgent.executionTarget.switchRunning'));
      return;
    }
    selecting.current = true;
    try {
      if (!(await enableExecution())) throw new Error('Execution target was not saved');
      if (topicId && next !== provider) {
        const result = await cottiSandboxService.switchUnusedTopic(topicId, next);
        if (result.status === 'running') {
          toast.error(t('heteroAgent.executionTarget.switchRunning'));
          return;
        }
        if (result.status === 'new_topic_required') {
          confirmModal({
            title: t('heteroAgent.executionTarget.switchTitle'),
            content: t('heteroAgent.executionTarget.switchDesc'),
            okText: t('heteroAgent.executionTarget.newTopic'),
            cancelText: t('cancel', { ns: 'common' }),
            onOk: async () => {
              await switchTopic(null);
              setPendingSandboxProvider(agentId, next);
            },
          });
          return;
        }
        await refreshTopic();
      }
      setPendingSandboxProvider(agentId, next);
    } catch (error) {
      console.error('[sandbox-selection] Failed to select execution environment', error);
      toast.error(t('heteroAgent.executionTarget.selectFailed'));
    } finally {
      selecting.current = false;
    }
  };
  return { provider, select, selfHostedAvailable: data?.selfHostedAvailable === true };
};
