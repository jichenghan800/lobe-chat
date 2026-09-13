import type { AgentStreamEvent } from '@lobechat/agent-gateway-client';

import { aiAgentService } from '@/services/aiAgent';

/** Queue deployments have no Gateway websocket. Poll authoritative runtime state;
 * partial messages and parked operations are never evidence of completion. */
export const pollQueueOperation = async ({
  operationId,
  signal,
  onEvent,
  onComplete,
  onTimeout,
}: {
  onComplete: (succeeded: boolean) => void;
  onTimeout: () => void;
  onEvent: (event: AgentStreamEvent) => void;
  operationId: string;
  signal: AbortSignal;
}): Promise<void> => {
  const deadline = Date.now() + 30 * 60_000;
  const emit = (type: AgentStreamEvent['type'], data: unknown) =>
    onEvent({ data, operationId, stepIndex: 0, timestamp: Date.now(), type });

  while (!signal.aborted && Date.now() < deadline) {
    try {
      const result = await aiAgentService.getOperationStatus(
        operationId,
        AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
      );
      if (signal.aborted) return;
      const status = result?.currentState.status;
      if (status === 'done' || status === 'interrupted' || status === 'error') {
        // The existing handler reconciles all message roles and owns the run
        // lifecycle, notifications and queued follow-ups.
        if (status === 'error') emit('error', result?.currentState.error);
        else emit('agent_runtime_end', { reason: status });
        onComplete(status === 'done');
        return;
      }
      emit('notify_update', {});
    } catch (error) {
      // A transient status request failure must not mark the server run failed.
      if (!signal.aborted) console.error('[QueueOperation] status refresh failed', error);
    }
    await new Promise<void>((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', finish);
        resolve();
      };
      const timer = setTimeout(finish, 3000);
      signal.addEventListener('abort', finish, { once: true });
      if (signal.aborted) finish();
    });
  }
  if (!signal.aborted) {
    onTimeout();
    // Do not settle the server topic: a monitoring timeout is not execution failure.
  }
};
