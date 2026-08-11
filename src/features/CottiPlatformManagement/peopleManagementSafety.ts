import type { CottiAgentAccessMode } from '@/types/cotti/agentAccess';

export const shouldConfirmAgentAccessModeChange = (
  currentMode: CottiAgentAccessMode,
  nextMode: CottiAgentAccessMode,
) => currentMode !== nextMode && nextMode === 'open';

export const isLoginAccessModeSelectable = (mode: 'allowlist' | 'open') => mode !== 'open';
