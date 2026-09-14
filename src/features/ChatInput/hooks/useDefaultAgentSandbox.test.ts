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
    { target: 'auto' as const },
  ])('preserves existing choices or unavailable permissions: %j', (patch) => {
    expect(shouldDefaultAgentSandbox({ ...base, ...patch })).toBe(false);
  });
  it('persists through the selection action once and waits for preference loading', async () => {
    const save = vi.fn(async () => true);
    const { rerender } = renderHook(
      ({ loading, target }) => useDefaultAgentSandbox('agent', { ...base, loading, target }, save),
      {
        initialProps: { loading: true, target: 'none' as 'none' | 'sandbox' },
      },
    );
    expect(save).not.toHaveBeenCalled();
    await act(async () => rerender({ loading: false, target: 'none' }));
    expect(save).toHaveBeenCalledExactlyOnceWith('sandbox');
    await act(async () => rerender({ loading: false, target: 'sandbox' }));
    expect(save).toHaveBeenCalledTimes(1);
  });
});
