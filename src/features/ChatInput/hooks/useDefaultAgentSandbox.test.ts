import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { shouldDefaultAgentSandbox, useDefaultAgentSandbox } from './useDefaultAgentSandbox';

const base = { enabled: true, canSelect: true, isDesktop: false, isHetero: false, loading: false };

describe('native web Agent sandbox default', () => {
  it('repairs both missing and hidden no-device targets', () => {
    expect(shouldDefaultAgentSandbox(base)).toBe(true);
    expect(shouldDefaultAgentSandbox({ ...base, target: 'none' })).toBe(true);
  });
  it.each([
    { enabled: false },
    { canSelect: false },
    { loading: true },
    { isDesktop: true },
    { isHetero: true },
    { boundDeviceId: 'existing-device' },
    { target: 'sandbox' as const },
    { target: 'device' as const },
    { target: 'local' as const },
  ])('preserves existing choices or unavailable permissions: %j', (patch) => {
    expect(shouldDefaultAgentSandbox({ ...base, ...patch })).toBe(false);
  });
  it('repairs legacy auto without changing explicit device bindings or desktop routing', () => {
    expect(shouldDefaultAgentSandbox({ ...base, target: 'auto' })).toBe(true);
    expect(shouldDefaultAgentSandbox({ ...base, target: 'auto', boundDeviceId: 'pc' })).toBe(false);
    expect(shouldDefaultAgentSandbox({ ...base, target: 'auto', isDesktop: true })).toBe(false);
    expect(shouldDefaultAgentSandbox({ ...base, target: 'auto', isHetero: true })).toBe(false);
  });
  it.each(['none', 'auto'] as const)(
    'persists %s once after preference loading',
    async (legacyTarget) => {
      const save = vi.fn(async () => true);
      const { rerender } = renderHook(
        ({ loading, target }) =>
          useDefaultAgentSandbox('agent', { ...base, loading, target }, save),
        {
          initialProps: { loading: true, target: legacyTarget as 'none' | 'auto' | 'sandbox' },
        },
      );
      expect(save).not.toHaveBeenCalled();
      await act(async () => rerender({ loading: false, target: legacyTarget }));
      expect(save).toHaveBeenCalledExactlyOnceWith('sandbox');
      await act(async () => rerender({ loading: false, target: 'sandbox' }));
      expect(save).toHaveBeenCalledTimes(1);
    },
  );
});
