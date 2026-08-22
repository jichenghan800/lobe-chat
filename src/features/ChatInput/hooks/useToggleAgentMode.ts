'use client';

import { useCallback } from 'react';

import { useBusinessCanEnableAgentMode } from '@/business/client/hooks/useBusinessAgentMode';
import { useAgentManagementAccess } from '@/features/ResourcePermission/useAgentManagementAccess';
import { useAgentStore } from '@/store/agent';
import { agentByIdSelectors } from '@/store/agent/selectors';
import { useUserStore } from '@/store/user';

import { useAgentId } from './useAgentId';
import { useSwitchModelDisplayScope } from './useSwitchModelDisplayScope';
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
  const switchModelDisplayScope = useSwitchModelDisplayScope();
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
      const modelApplied = await switchModelDisplayScope(targetScope);
      if (!modelApplied) return false;

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
      agentId,
      canEnableBusinessAgentMode,
      isAccessLoading,
      switchModelDisplayScope,
      updateAgentChatConfig,
      updateWorkspaceUserPreference,
      usesWorkspaceMemberMode,
    ],
  );
};
