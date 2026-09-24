import type { TopicSandboxProvider } from '@lobechat/types';

// A selection made before the first message is carried into topic creation.
// Existing topics always read their persisted metadata, never this preference.
const selections = new Map<string, TopicSandboxProvider>();
const listeners = new Set<() => void>();

export const getPendingSandboxProvider = (agentId: string): TopicSandboxProvider =>
  selections.get(agentId) ?? 'market';

export const setPendingSandboxProvider = (agentId: string, provider: TopicSandboxProvider) => {
  selections.set(agentId, provider);
  for (const listener of listeners) listener();
};

export const subscribePendingSandboxProvider = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
