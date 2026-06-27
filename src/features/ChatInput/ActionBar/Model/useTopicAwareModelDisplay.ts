import { useAgentStore } from '@/store/agent';
import { agentByIdSelectors } from '@/store/agent/selectors';
import { useChatStore } from '@/store/chat';
import { dbMessageSelectors, topicSelectors } from '@/store/chat/selectors';

import { useAgentId } from '../../hooks/useAgentId';

const getLatestMessageModel = (
  messages: ReturnType<typeof dbMessageSelectors.activeDbMessages>,
): { model?: string; provider?: string } => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.model && message.provider) {
      return { model: message.model, provider: message.provider };
    }
  }

  return {};
};

export const useTopicAwareModelDisplay = () => {
  const agentId = useAgentId();
  const [agentModel, agentProvider, enableAgentMode, isAgentConfigLoading, updateAgentConfigById] =
    useAgentStore((s) => [
      agentByIdSelectors.getAgentModelById(agentId)(s),
      agentByIdSelectors.getAgentModelProviderById(agentId)(s),
      agentByIdSelectors.getAgentEnableModeById(agentId)(s),
      agentByIdSelectors.isAgentConfigLoadingById(agentId)(s),
      s.updateAgentConfigById,
    ]);
  const [activeTopicId, topicSummary, messageModel] = useChatStore((s) => [
    s.activeTopicId,
    topicSelectors.currentActiveTopicSummary(s),
    getLatestMessageModel(dbMessageSelectors.activeDbMessages(s)),
  ]);

  const topicModel = topicSummary?.model || messageModel.model;
  const topicProvider = topicSummary?.provider || messageModel.provider;
  const isTopicModelHydrating = !!activeTopicId && !topicModel;

  return {
    agentId,
    enableAgentMode,
    isModelDisplayLoading: isAgentConfigLoading || isTopicModelHydrating,
    model: topicModel || (isTopicModelHydrating ? '' : agentModel),
    provider: topicProvider || (isTopicModelHydrating ? '' : agentProvider),
    updateAgentConfigById,
  };
};
