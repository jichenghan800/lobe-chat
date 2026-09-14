import type { TopicSandboxProvider } from '@lobechat/types';
import { confirmModal, toast } from '@lobehub/ui/base-ui';
import { useSyncExternalStore } from 'react';
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
import { topicSelectors } from '@/store/chat/selectors';

export const useSandboxSelection = (agentId: string, enableExecution: () => Promise<boolean>) => {
  const { t } = useTranslation('chat');
  const topicScope = useChatInputStore((s) => s.topicModelScope);
  const topicId = useChatStore((s) =>
    topicScope && s.activeAgentId === agentId ? s.activeTopicId : undefined,
  );
  const metadata = useChatStore(topicSelectors.currentTopicMetadata);
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

  const select = (next: TopicSandboxProvider) => {
    const apply = async () => {
      try {
        if (!(await enableExecution())) throw new Error('Execution target was not saved');
        if (topicId && provider !== next) await switchTopic(null);
        setPendingSandboxProvider(agentId, next);
      } catch (error) {
        console.error('[sandbox-selection] Failed to select execution environment', error);
        toast.error(t('heteroAgent.executionTarget.selectFailed'));
      }
    };
    if (topicId && next !== provider) {
      confirmModal({
        title: t('heteroAgent.executionTarget.switchTitle'),
        content: t('heteroAgent.executionTarget.switchDesc'),
        okText: t('heteroAgent.executionTarget.newTopic'),
        cancelText: t('cancel', { ns: 'common' }),
        onOk: apply,
      });
    } else void apply();
  };
  return { provider, select, selfHostedAvailable: data?.selfHostedAvailable === true };
};
