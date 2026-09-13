import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { aiAgentService } from '@/services/aiAgent';

import { pollQueueOperation } from './pollQueueOperation';

describe('queue operation result synchronization', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const state = (status: string) =>
    ({ currentState: { status } }) as Awaited<ReturnType<typeof aiAgentService.getOperationStatus>>;
  const setup = () => {
    const controller = new AbortController();
    const callbacks = { onComplete: vi.fn(), onEvent: vi.fn(), onTimeout: vi.fn() };
    return {
      callbacks,
      controller,
      run: () =>
        pollQueueOperation({ ...callbacks, operationId: 'server-1', signal: controller.signal }),
    };
  };

  it('keeps partial and parked results running until an authoritative terminal state', async () => {
    const request = vi
      .spyOn(aiAgentService, 'getOperationStatus')
      .mockResolvedValueOnce(state('running'))
      .mockResolvedValueOnce(state('waiting_for_async_tool'))
      .mockResolvedValueOnce(state('waiting_for_human'))
      .mockResolvedValue(state('done'));
    const { run, callbacks } = setup();
    const promise = run();
    await vi.advanceTimersByTimeAsync(6000);
    expect(callbacks.onComplete).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3000);
    await promise;
    expect(request).toHaveBeenCalledWith('server-1', expect.any(AbortSignal));
    expect(callbacks.onEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'agent_runtime_end', data: { reason: 'done' } }),
    );
    expect(callbacks.onComplete).toHaveBeenCalledExactlyOnceWith(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['error', 'interrupted'])('does not treat %s as success', async (status) => {
    vi.spyOn(aiAgentService, 'getOperationStatus').mockResolvedValue(state(status));
    const { run, callbacks } = setup();
    await run();
    expect(callbacks.onComplete).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('stops polling after cancellation and ignores an in-flight response', async () => {
    let resolve!: (value: Awaited<ReturnType<typeof aiAgentService.getOperationStatus>>) => void;
    vi.spyOn(aiAgentService, 'getOperationStatus').mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const { run, controller, callbacks } = setup();
    const promise = run();
    controller.abort();
    resolve(state('done'));
    await promise;
    expect(callbacks.onEvent).not.toHaveBeenCalled();
    expect(callbacks.onComplete).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retries transient failures without marking execution failed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(aiAgentService, 'getOperationStatus')
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(state('done'));
    const { run, callbacks } = setup();
    const promise = run();
    await vi.advanceTimersByTimeAsync(3000);
    await promise;
    expect(callbacks.onComplete).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('bounds missing operations without emitting a persisted execution error or settling the server', async () => {
    vi.spyOn(aiAgentService, 'getOperationStatus').mockResolvedValue(null);
    const { run, callbacks } = setup();
    const promise = run();
    await vi.advanceTimersByTimeAsync(30 * 60_000);
    await promise;
    expect(callbacks.onTimeout).toHaveBeenCalledOnce();
    expect(callbacks.onComplete).not.toHaveBeenCalled();
    expect(callbacks.onEvent.mock.calls.every(([event]) => event.type === 'notify_update')).toBe(
      true,
    );
    expect(vi.getTimerCount()).toBe(0);
  });
});
