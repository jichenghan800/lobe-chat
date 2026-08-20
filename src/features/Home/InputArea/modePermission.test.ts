import { describe, expect, it } from 'vitest';

import { isHomeModeDisabled, resolvePermittedHomeMode } from './modePermission';

const allowed = {
  canCreateContent: true,
  canEnableAgentMode: true,
  isAgentModeAccessResolved: true,
};

describe('home mode permission', () => {
  it('keeps restricted users out of Task mode', () => {
    const permission = { ...allowed, canCreateContent: false };

    expect(isHomeModeDisabled('task', permission)).toBe(true);
    expect(resolvePermittedHomeMode('task', permission)).toBe('chat');
  });

  it('keeps Agent disabled until access is resolved and granted', () => {
    expect(isHomeModeDisabled('agent', { ...allowed, isAgentModeAccessResolved: false })).toBe(
      true,
    );
    expect(isHomeModeDisabled('agent', { ...allowed, canEnableAgentMode: false })).toBe(true);
    expect(resolvePermittedHomeMode('agent', allowed)).toBe('agent');
  });

  it('does not alter modes that the user may enter', () => {
    const readOnly = { ...allowed, canCreateContent: false };

    expect(isHomeModeDisabled('chat', readOnly)).toBe(false);
    expect(resolvePermittedHomeMode('chat', readOnly)).toBe('chat');
    expect(resolvePermittedHomeMode('task', allowed)).toBe('task');
  });
});
