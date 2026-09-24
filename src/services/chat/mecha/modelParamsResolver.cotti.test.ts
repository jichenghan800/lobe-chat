import { resolveModelParams } from '@lobechat/mecha';
import { describe, expect, it } from 'vitest';

describe('COTTI reasoning defaults through the shared resolver', () => {
  it.each([
    { configured: undefined, expected: 'medium' },
    { configured: 'low' as const, expected: 'low' },
    { configured: 'high' as const, expected: 'high' },
  ])(
    'preserves explicit reasoning or defaults to medium: $expected',
    async ({ configured, expected }) => {
      const facts = await resolveModelParams(
        { agent: { id: 'agent', chatConfig: {} }, model: 'gpt-4', provider: 'openai' },
        {
          listModelCards: () => [
            { id: 'gpt-4', providerId: 'openai', extendParams: ['reasoningEffort'] },
          ],
          getModelReasoningConfig: async () =>
            configured ? { reasoningEffort: configured } : undefined,
        },
      );
      expect(facts.resolvedExtendParams?.reasoning_effort).toBe(expected);
    },
  );
});
