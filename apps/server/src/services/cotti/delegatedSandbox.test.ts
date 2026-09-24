import { describe, expect, it } from 'vitest';

import { shouldInheritTopicSandbox } from './delegatedSandbox';

const base = { isolationThread: true, shareVisitor: false, hasExplicitDevice: false };

describe('delegated topic sandbox eligibility', () => {
  it.each([undefined, 'none', 'auto'] as const)(
    'accepts legacy native targets: %s',
    (executionTarget) => {
      expect(shouldInheritTopicSandbox({ ...base, agencyConfig: { executionTarget } })).toBe(true);
    },
  );
  it.each(['sandbox', 'local', 'device'] as const)(
    'preserves an explicit environment: %s',
    (executionTarget) => {
      expect(shouldInheritTopicSandbox({ ...base, agencyConfig: { executionTarget } })).toBe(false);
    },
  );
  it.each([
    { isolationThread: false },
    { shareVisitor: true },
    { hasExplicitDevice: true },
    { agencyConfig: { boundDeviceId: 'pc' } },
    { agencyConfig: { heterogeneousProvider: { type: 'claude-code' as const } } },
    { chatConfig: { enableAgentMode: false } },
    { chatConfig: { toolMode: 'custom' as const } },
  ])('preserves permissions and non-delegated behavior: %j', (patch) => {
    expect(shouldInheritTopicSandbox({ ...base, ...patch })).toBe(false);
  });
});
