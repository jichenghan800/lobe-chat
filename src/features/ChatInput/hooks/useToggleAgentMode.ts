'use client';

import { useCallback } from 'react';

import { useCottiModelDisplayConfig } from '@/_custom/hooks/useCottiModelDisplayConfig';
import {
  applyModelDisplayConfig,
  isSameModelDisplayRef,
  resolveModelDisplayTargetModel,
} from '@/_custom/registry/modelDisplayConfig';
import { useBusinessCanEnableAgentMode } from '@/business/client/hooks/useBusinessAgentMode';
import { useAgentManagementAccess } from '@/features/ResourcePermission/useAgentManagementAccess';
import { useAgentStore } from '@/store/agent';
import { agentByIdSelectors } from '@/store/agent/selectors';
import { useAiInfraStore } from '@/store/aiInfra';
import { useChatStore } from '@/store/chat';
import { topicSelectors } from '@/store/chat/slices/topic/selectors';
import { useUserStore } from '@/store/user';

import { useChatInputStore } from '../store';
import { useAgentId } from './useAgentId';
import { useAgentModelSelection } from './useAgentModelSelection';
import { useUpdateAgentConfig } from './useUpdateAgentConfig';

/**
 * Toggle between chat mode and agent mode.
 *
 * The flag is stored on `chatConfig.enableAgentMode` so it persists (chat_config
 * is a jsonb column) and is readable on the server. The `plugins` array is left
 * untouched — chat mode is enforced at the runtime tools engine layer.
 */
export const useToggleAgentMode = () => {
  const agentId = useAgentId();
  const { updateAgentChatConfig } = useUpdateAgentConfig();
  const canEnableBusinessAgentMode = useBusinessCanEnableAgentMode(agentId);
  const { data: modelDisplayConfig, mutate: refreshModelDisplayConfig } =
    useCottiModelDisplayConfig();
  const enabledChatModelList = useAiInfraStore((s) => s.enabledChatModelList || []);
  const {
    canSelectModel,
    model: selectedModel,
    provider: selectedProvider,
    selectModel,
  } = useAgentModelSelection(agentId);
  const activeTopicId = useChatStore((s) => s.activeTopicId);
  const activeTopicModel = useChatStore(topicSelectors.activeTopicModel);
  const topicModelScope = useChatInputStore((s) => s.topicModelScope);
  const updateTopicModel = useChatStore((s) => s.updateTopicModel);
  const currentModel =
    topicModelScope && activeTopicModel?.model
      ? activeTopicModel
      : { model: selectedModel, provider: selectedProvider };
  const agent = useAgentStore(agentByIdSelectors.getAgentById(agentId));
  const { canManageAgent, isAccessLoading } = useAgentManagementAccess(agentId);
  const usesWorkspaceMemberMode =
    !!agent?.workspaceId && agent.visibility !== 'private' && !canManageAgent;
  const updateWorkspaceUserPreference = useUserStore((s) => s.updateWorkspaceUserPreference);

  return useCallback(
    async (enable: boolean) => {
      if (isAccessLoading) return false;

      if (enable && !canEnableBusinessAgentMode) return false;

      const enableAgentMode = enable && canEnableBusinessAgentMode;
      const targetScope = enableAgentMode ? 'agent' : 'chat';
      let resolvedModelDisplayConfig = modelDisplayConfig;
      if (!resolvedModelDisplayConfig) {
        try {
          resolvedModelDisplayConfig = await refreshModelDisplayConfig();
        } catch (error) {
          console.error(
            '[useToggleAgentMode] Failed to load the COTTI model display config',
            error,
          );
          return false;
        }
      }
      if (!resolvedModelDisplayConfig) return false;

      const availableModels = applyModelDisplayConfig(
        enabledChatModelList,
        resolvedModelDisplayConfig[targetScope],
      );
      const targetModel = resolveModelDisplayTargetModel({
        availableModels: availableModels || [],
        config: resolvedModelDisplayConfig,
        currentModel,
        targetScope,
      });
      if (!targetModel) return false;

      if (!isSameModelDisplayRef(currentModel, targetModel)) {
        if (!canSelectModel) return false;

        if (topicModelScope && activeTopicId) await updateTopicModel(activeTopicId, targetModel);
        else await selectModel(targetModel);
      }

      if (usesWorkspaceMemberMode) {
        await updateWorkspaceUserPreference({
          agentModeOverrides: { [agentId]: enableAgentMode },
        });
        return true;
      }

      await updateAgentChatConfig({ enableAgentMode });
      return true;
    },
    [
      activeTopicId,
      agentId,
      canSelectModel,
      canEnableBusinessAgentMode,
      currentModel,
      enabledChatModelList,
      isAccessLoading,
      modelDisplayConfig,
      refreshModelDisplayConfig,
      selectModel,
      updateAgentChatConfig,
      updateTopicModel,
      updateWorkspaceUserPreference,
      usesWorkspaceMemberMode,
      topicModelScope,
    ],
  );
};
