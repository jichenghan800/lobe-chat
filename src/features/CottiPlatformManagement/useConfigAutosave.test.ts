import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ModelDisplayConfig } from '@/types/modelDisplay';

import { useConfigAutosave } from './useConfigAutosave';

const initial = { agent: [], chat: [] } as unknown as ModelDisplayConfig;
const changed = { ...initial, chat: [{ model: 'test', provider: 'test', enabled: true }] };

describe('model management autosave', () => {
  it('persists a switch change immediately without a Save button', async () => {
    const persist = vi.fn().mockResolvedValue(changed);
    const { result } = renderHook(() => useConfigAutosave(initial, persist));
    await act(() => result.current.save(changed));
    expect(persist).toHaveBeenCalledWith(changed);
    expect(result.current.draft).toEqual(changed);
    expect(result.current.status).toBe('saved');
  });

  it('rolls back failed changes and allows explicit retry', async () => {
    const persist = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(changed);
    const { result } = renderHook(() => useConfigAutosave(initial, persist));
    await act(() => result.current.save(changed));
    expect(result.current.draft).toEqual(initial);
    expect(result.current.status).toBe('failed');
    await act(async () => {
      await result.current.retry();
    });
    expect(result.current.draft).toEqual(changed);
    expect(result.current.status).toBe('saved');
  });

  it('locks overlapping writes and ignores focus revalidation while saving', async () => {
    let finish!: (value: ModelDisplayConfig) => void;
    const persist = vi.fn(
      () =>
        new Promise<ModelDisplayConfig>((resolve) => {
          finish = resolve;
        }),
    );
    const { result, rerender } = renderHook(({ config }) => useConfigAutosave(config, persist), {
      initialProps: { config: initial },
    });
    act(() => {
      void result.current.save(changed);
    });
    rerender({ config: { ...initial } });
    expect(result.current.draft).toEqual(changed);
    await act(() => result.current.save({ ...changed, agent: changed.chat }));
    expect(persist).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish(changed);
    });
    await waitFor(() => expect(result.current.saving).toBe(false));
  });

  it('does not write unchanged names on blur', async () => {
    const persist = vi.fn();
    const { result } = renderHook(() => useConfigAutosave(initial, persist));
    await act(() => result.current.save({ ...initial }));
    expect(persist).not.toHaveBeenCalled();
  });
});
