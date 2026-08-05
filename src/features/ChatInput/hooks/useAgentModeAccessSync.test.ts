import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useAgentModeAccessSync } from './useAgentModeAccessSync';

const createParams = () => ({
  canEnableAgentMode: false,
  isAccessLoading: false,
  isAccessResolved: true,
  isPreferenceLoading: false,
  requestedAgentModeEnabled: true,
  toggleAgentMode: vi.fn().mockResolvedValue(undefined),
});

describe('useAgentModeAccessSync', () => {
  it('persists Chat mode after explicit Agent-mode access is revoked', () => {
    const params = createParams();

    renderHook(() => useAgentModeAccessSync(params));

    expect(params.toggleAgentMode).toHaveBeenCalledWith(false);
  });

  it.each([
    ['access is still loading', { isAccessLoading: true }],
    ['access is unresolved', { isAccessResolved: false }],
    ['the user remains allowed', { canEnableAgentMode: true }],
    ['the preference is loading', { isPreferenceLoading: true }],
    ['Chat mode is already persisted', { requestedAgentModeEnabled: false }],
  ])('does not write while %s', (_, override) => {
    const params = { ...createParams(), ...override };

    renderHook(() => useAgentModeAccessSync(params));

    expect(params.toggleAgentMode).not.toHaveBeenCalled();
  });
});
