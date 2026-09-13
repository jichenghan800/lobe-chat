import { useEffect } from 'react';
import useSWR from 'swr';

import { topicService } from '@/services/topic';
import { useChatStore } from '@/store/chat';

import { useChatInputStore, useStoreApi } from './store';

export const TopicCostFreezeLoader = () => {
  const input = useStoreApi();
  const [agentId, scoped, generating] = useChatInputStore((s) => [
    s.agentId,
    s.topicModelScope,
    s.sendButtonProps?.generating,
  ]);
  const [topicId, activeAgentId] = useChatStore((s) => [s.activeTopicId, s.activeAgentId]);
  const enabled = scoped && !!topicId && !!agentId && agentId === activeAgentId;
  const { data } = useSWR(
    enabled ? ['topic-cost-freeze', topicId] : null,
    () => topicService.getCostFreeze(topicId!),
    {
      refreshInterval: generating ? 2000 : 30_000,
      revalidateOnFocus: true,
    },
  );
  useEffect(() => {
    input.setState({ costFrozen: enabled && !!data });
    return () => input.setState({ costFrozen: false });
  }, [input, enabled, data, topicId]);
  return null;
};
