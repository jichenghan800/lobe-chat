import type { HomeMode } from '../types';

export interface HomeModePermission {
  canCreateContent: boolean;
  canEnableAgentMode: boolean;
  isAgentModeAccessResolved: boolean;
}

export const isHomeModeDisabled = (mode: HomeMode, permission: HomeModePermission): boolean => {
  if (mode === 'task') return !permission.canCreateContent;

  if (mode === 'agent') {
    return (
      !permission.canCreateContent ||
      !permission.isAgentModeAccessResolved ||
      !permission.canEnableAgentMode
    );
  }

  return false;
};

export const resolvePermittedHomeMode = (
  mode: HomeMode,
  permission: HomeModePermission,
): HomeMode => (isHomeModeDisabled(mode, permission) ? 'chat' : mode);
