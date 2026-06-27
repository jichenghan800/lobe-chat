'use client';

import { useCallback } from 'react';

import { getCottiModeFallbackConfig } from '@/_custom/registry/modelAvailability';
import { useBusinessCanEnableAgentMode } from '@/business/client/hooks/useBusinessAgentMode';
import { useAgentStore } from '@/store/agent';
import { agentByIdSelectors } from '@/store/agent/selectors';
import { serverConfigSelectors, useServerConfigStore } from '@/store/serverConfig';

import { useAgentId } from './useAgentId';
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
  const { updateAgentConfig } = useUpdateAgentConfig();
  const canEnableBusinessAgentMode = useBusinessCanEnableAgentMode(agentId);
  const enableCottiAgentAccess = useServerConfigStore(serverConfigSelectors.enableCottiAgentAccess);

  return useCallback(
    (enable: boolean) => {
      const enableAgentMode = enable && canEnableBusinessAgentMode && enableCottiAgentAccess;
      const agentState = useAgentStore.getState();
      const modelId = agentByIdSelectors.getAgentModelById(agentId)(agentState);
      const fallbackConfig = getCottiModeFallbackConfig({ enableAgentMode, modelId });
      const modeConfig = fallbackConfig
        ? { ...fallbackConfig, chatConfig: { enableAgentMode } }
        : { chatConfig: { enableAgentMode } };

      return updateAgentConfig(modeConfig);
    },
    [agentId, canEnableBusinessAgentMode, enableCottiAgentAccess, updateAgentConfig],
  );
};
