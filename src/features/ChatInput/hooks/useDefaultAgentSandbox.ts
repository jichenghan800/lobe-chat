import type { DeviceExecutionTarget } from '@lobechat/types';
import { useEffect } from 'react';

import { useSingleton } from '@/hooks/useSingleton';

interface DefaultAgentSandboxOptions {
  boundDeviceId?: string;
  canSelect: boolean;
  enabled: boolean;
  isDesktop: boolean;
  isHetero: boolean;
  loading: boolean;
  target?: DeviceExecutionTarget;
}

/** The web product exposes sandbox choices only; a native Agent must not keep the hidden none/auto choices. */
export const shouldDefaultAgentSandbox = (options: DefaultAgentSandboxOptions) =>
  options.enabled &&
  options.canSelect &&
  !options.loading &&
  !options.isDesktop &&
  !options.isHetero &&
  !options.boundDeviceId &&
  (options.target === undefined || options.target === 'none' || options.target === 'auto');

/** Repair a legacy/unset choice through the normal permission-aware save path, not just the label. */
export const useDefaultAgentSandbox = (
  agentId: string,
  options: DefaultAgentSandboxOptions,
  select: (target: DeviceExecutionTarget) => Promise<boolean>,
) => {
  const pending = useSingleton(() => new Set<string>());
  const required = shouldDefaultAgentSandbox(options);
  useEffect(() => {
    if (!required || pending.has(agentId)) return;
    const requests = pending;
    requests.add(agentId);
    // select reports save failures using the existing UI. Never mutate a topic's sandbox provider.
    void select('sandbox').then(
      () => requests.delete(agentId),
      () => requests.delete(agentId),
    );
  }, [agentId, pending, required, select]);
};
