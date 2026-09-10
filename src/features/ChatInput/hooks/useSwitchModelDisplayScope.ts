'use client';
import { useCallback } from 'react';

import { useCottiModelDisplayConfig } from '@/_custom/hooks/useCottiModelDisplayConfig';
import {
  applyModelDisplayConfig,
  isSameModelDisplayRef,
  resolveModelDisplayTargetModel,
} from '@/_custom/registry/modelDisplayConfig';
import { useAiInfraStore } from '@/store/aiInfra';
import { useChatStore } from '@/store/chat';
import { topicSelectors } from '@/store/chat/slices/topic/selectors';
import type { ModelDisplayScope } from '@/types/modelDisplay';

import { useChatInputStore } from '../store';
import { useAgentId } from './useAgentId';
import { useAgentModelSelection } from './useAgentModelSelection';

/**
 * Keep the effective model inside a COTTI display scope.
 *
 * This only resolves and writes the model selection. It deliberately does not
 * toggle Agent mode or enforce Agent-entry admission, so autonomous surfaces
 * such as Task can reuse the Agent model pool without becoming an Agent-mode
 * UI entry point.
 */
export const useSwitchModelDisplayScope = () => {
  const topicModelScope = useChatInputStore((s) => s.topicModelScope !== false);
  const agentId = useAgentId();
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
  const updateTopicModel = useChatStore((s) => s.updateTopicModel);
  const currentModel = activeTopicModel?.model
    ? activeTopicModel
    : { model: selectedModel, provider: selectedProvider };

  return useCallback(
    async (targetScope: ModelDisplayScope) => {
      let resolvedModelDisplayConfig = modelDisplayConfig;
      if (!resolvedModelDisplayConfig) {
        try {
          resolvedModelDisplayConfig = await refreshModelDisplayConfig();
        } catch (error) {
          console.error(
            '[useSwitchModelDisplayScope] Failed to load the COTTI model display config',
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

      if (isSameModelDisplayRef(currentModel, targetModel)) return true;
      if (!canSelectModel) return false;

      if (topicModelScope && activeTopicId) await updateTopicModel(activeTopicId, targetModel);
      else await selectModel(targetModel);

      return true;
    },
    [
      activeTopicId,
      topicModelScope,
      canSelectModel,
      currentModel,
      enabledChatModelList,
      modelDisplayConfig,
      refreshModelDisplayConfig,
      selectModel,
      updateTopicModel,
    ],
  );
};
