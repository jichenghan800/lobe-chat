import type { HomeMode } from '../types';

export const isHomeModeDisabled = (
  mode: HomeMode,
  canCreateContent: boolean,
  canUseAgent = true,
): boolean => (mode === 'task' && !canCreateContent) || (mode !== 'chat' && !canUseAgent);

export const resolvePermittedHomeMode = (
  mode: HomeMode,
  canCreateContent: boolean,
  canUseAgent = true,
): HomeMode => (isHomeModeDisabled(mode, canCreateContent, canUseAgent) ? 'chat' : mode);
