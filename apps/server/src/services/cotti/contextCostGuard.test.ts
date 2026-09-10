import { countContextTokens } from '@lobechat/context-engine';
import { getModelPropertyWithFallback } from '@lobechat/model-runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createContextCostGuard } from './contextCostGuard';

vi.mock('@lobechat/context-engine', () => ({ countContextTokens: vi.fn() }));
vi.mock('@lobechat/model-runtime', () => ({
  getModelPropertyWithFallback: vi.fn(),
  AgentRuntimeError: {
    createError: (_type: string, body: { message: string }) => new Error(body.message),
  },
}));

describe('final context cost guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getModelPropertyWithFallback).mockImplementation(async (_model, field) =>
      field === 'contextWindowTokens'
        ? 1_050_000
        : {
            units: [
              {
                name: 'textInput',
                strategy: 'tiered',
                tiers: [
                  { rate: 2, upTo: 272_000 },
                  { rate: 4, upTo: 'infinity' },
                ],
              },
            ],
          },
    );
  });
  it('blocks a large final payload before any upstream request', async () => {
    vi.mocked(countContextTokens).mockReturnValue({
      rawTotal: 250_000,
      adjustedTotal: 312_500,
    } as ReturnType<typeof countContextTokens>);
    await expect(
      createContextCostGuard('azure').beforeChat!({ model: 'terra', messages: [] }),
    ).rejects.toThrow('上下文过大');
  });
  it('allows a smaller payload and accounts for tool definitions', async () => {
    vi.mocked(countContextTokens).mockReturnValue({
      rawTotal: 50_000,
      adjustedTotal: 62_500,
    } as ReturnType<typeof countContextTokens>);
    const payload = {
      model: 'terra',
      messages: [{ role: 'user' as const, content: 'hello' }],
      tools: [{ type: 'function' as const, function: { name: 'lookup' } }],
    };
    await expect(createContextCostGuard('azure').beforeChat!(payload)).resolves.toBeUndefined();
    expect(countContextTokens).toHaveBeenCalledWith({
      messages: payload.messages,
      tools: payload.tools,
    });
  });
});
