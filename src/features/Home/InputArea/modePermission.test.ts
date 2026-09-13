import { describe, expect, it } from 'vitest';

import { isHomeModeDisabled, resolvePermittedHomeMode } from './modePermission';

describe('home mode permission', () => {
  it('blocks Agent and Task independently of content access while preserving Chat', () => {
    expect(isHomeModeDisabled('agent', true, false)).toBe(true);
    expect(isHomeModeDisabled('task', true, false)).toBe(true);
    expect(resolvePermittedHomeMode('agent', true, false)).toBe('chat');
    expect(isHomeModeDisabled('chat', true, false)).toBe(false);
  });

  it('keeps restricted users out of Task mode', () => {
    expect(isHomeModeDisabled('task', false)).toBe(true);
    expect(resolvePermittedHomeMode('task', false)).toBe('chat');
  });

  it('does not alter modes that the user may enter', () => {
    expect(isHomeModeDisabled('chat', false)).toBe(false);
    expect(resolvePermittedHomeMode('chat', false)).toBe('chat');
    expect(resolvePermittedHomeMode('task', true)).toBe('task');
  });
});
