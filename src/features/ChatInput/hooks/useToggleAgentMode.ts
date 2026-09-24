'use client';

import { isDesktop } from '@lobechat/const';
import { useCallback } from 'react';

import { useBusinessCanEnableAgentMode } from '@/business/client/hooks/useBusinessAgentMode';
import { useAgentManagementAccess } from '@/features/ResourcePermission/useAgentManagementAccess';
import { useEffectiveAgencyConfig } from '@/hooks/useEffectiveAgencyConfig';
import { useAgentStore } from '@/store/agent';
import { agentByIdSelectors } from '@/store/agent/selectors';
import { useUserStore } from '@/store/user';

import { useAgentId } from './useAgentId';
import { shouldDefaultAgentSandbox } from './useDefaultAgentSandbox';
import { useSelectExecutionTarget } from './useSelectExecutionTarget';
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
  const switchModelDisplayScope = useSwitchModelDisplayScope();
  const execution = useEffectiveAgencyConfig(agentId);
  const selectExecutionTarget = useSelectExecutionTarget(agentId);
  const { updateAgentChatConfig } = useUpdateAgentConfig();
  const canEnableBusinessAgentMode = useBusinessCanEnableAgentMode(agentId);
  const agent = useAgentStore(agentByIdSelectors.getAgentById(agentId));
  const { canManageAgent, isAccessLoading } = useAgentManagementAccess(agentId);
  const usesWorkspaceMemberMode =
    !!agent?.workspaceId && agent.visibility !== 'private' && !canManageAgent;
  const updateWorkspaceUserPreference = useUserStore((s) => s.updateWorkspaceUserPreference);

  return useCallback(
    async (enable: boolean) => {
      if (isAccessLoading || execution.isPreferenceLoading) return false;

      const enableAgentMode = enable && canEnableBusinessAgentMode;
      if (!(await switchModelDisplayScope(enableAgentMode ? 'agent' : 'chat'))) return false;
      if (
        shouldDefaultAgentSandbox({
          enabled: enableAgentMode,
          isDesktop,
          isHetero: !!execution.agencyConfig?.heterogeneousProvider?.type,
          canSelect: execution.canSelectExecutionTarget,
          loading: execution.isPreferenceLoading,
          target: execution.agencyConfig?.executionTarget,
          boundDeviceId: execution.agencyConfig?.boundDeviceId,
        }) &&
        !(await selectExecutionTarget('sandbox'))
      )
        return false;
      if (usesWorkspaceMemberMode) {
        await updateWorkspaceUserPreference({
          agentModeOverrides: { [agentId]: enableAgentMode },
        });
        return enableAgentMode === enable;
      }

      await updateAgentChatConfig({ enableAgentMode });
      return enableAgentMode === enable;
    },
    [
      execution,
      selectExecutionTarget,
      switchModelDisplayScope,
      agentId,
      canEnableBusinessAgentMode,
      isAccessLoading,
      updateAgentChatConfig,
      updateWorkspaceUserPreference,
      usesWorkspaceMemberMode,
    ],
  );
};
