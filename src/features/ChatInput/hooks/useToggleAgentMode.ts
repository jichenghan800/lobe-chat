'use client';

import { useCallback } from 'react';

import { useBusinessCanEnableAgentMode } from '@/business/client/hooks/useBusinessAgentMode';
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
  const { updateAgentChatConfig } = useUpdateAgentConfig();
  const canEnableBusinessAgentMode = useBusinessCanEnableAgentMode(agentId);
  const enableCottiAgentAccess = useServerConfigStore(serverConfigSelectors.enableCottiAgentAccess);

  return useCallback(
    (enable: boolean) =>
      updateAgentChatConfig({
        enableAgentMode: enable && canEnableBusinessAgentMode && enableCottiAgentAccess,
      }),
    [canEnableBusinessAgentMode, enableCottiAgentAccess, updateAgentChatConfig],
  );
};
