import { useEffect } from 'react';

interface UseAgentModeAccessSyncParams {
  canEnableAgentMode: boolean;
  isAccessLoading: boolean;
  isAccessResolved: boolean;
  isPreferenceLoading: boolean;
  requestedAgentModeEnabled: boolean;
  toggleAgentMode: (enabled: boolean) => Promise<void>;
}

/**
 * Persist a Chat-mode fallback once an administrator revokes explicit Agent-mode access.
 *
 * The effective-mode selector already closes Agent-only UI immediately, but the chat service
 * consumes the persisted `enableAgentMode` flag. Keeping both in sync prevents the next send from
 * re-entering Agent Runtime through a stale preference.
 */
export const useAgentModeAccessSync = ({
  canEnableAgentMode,
  isAccessLoading,
  isAccessResolved,
  isPreferenceLoading,
  requestedAgentModeEnabled,
  toggleAgentMode,
}: UseAgentModeAccessSyncParams) => {
  useEffect(() => {
    if (
      isAccessLoading ||
      !isAccessResolved ||
      isPreferenceLoading ||
      canEnableAgentMode ||
      !requestedAgentModeEnabled
    )
      return;

    void toggleAgentMode(false);
  }, [
    canEnableAgentMode,
    isAccessLoading,
    isAccessResolved,
    isPreferenceLoading,
    requestedAgentModeEnabled,
    toggleAgentMode,
  ]);
};
