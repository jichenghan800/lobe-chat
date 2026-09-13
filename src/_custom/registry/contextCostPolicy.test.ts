import type { Pricing } from 'model-bank';
import { describe, expect, it } from 'vitest';

import { getContextCostPolicy } from './contextCostPolicy';

const pricing: Pricing = {
  units: [
    {
      name: 'textInput',
      strategy: 'tiered',
      unit: 'millionTokens',
      tiers: [
        { rate: 2, upTo: 272_000 },
        { rate: 4, upTo: 'infinity' },
      ],
    },
  ],
};
describe('context cost policy', () => {
  it('uses the approved Gemini 3.8 request ceiling without requiring catalog capacity', () => {
    expect(
      getContextCostPolicy(undefined, undefined, { id: 'gemini-3.8-flash', provider: 'vertexai' }),
    ).toMatchObject({ freezeTokenLimit: 1_000_000, inputTokenLimit: 1_000_000 });
    expect(
      getContextCostPolicy(undefined, undefined, { id: 'gemini-3.5-flash', provider: 'vertexai' })
        .freezeTokenLimit,
    ).toBe(64_000);
    expect(
      getContextCostPolicy(undefined, undefined, { id: 'gemini-3.8-flash', provider: 'google' })
        .freezeTokenLimit,
    ).toBe(64_000);
  });
  it('keeps the independent freeze budget below the price tier', () => {
    expect(getContextCostPolicy(pricing, 1_050_000)).toMatchObject({
      freezeTokenLimit: 190_400,
      inputTokenLimit: 231_200,
      pricingBoundary: 272_000,
    });
  });
  it('honors smaller model capacity and does not invent a price tier', () => {
    expect(getContextCostPolicy(undefined, 32_000)).toMatchObject({
      freezeTokenLimit: 16_000,
      inputTokenLimit: 27_200,
      pricingBoundary: undefined,
    });
  });
  it('does not treat a decreasing tier as a surcharge', () => {
    expect(
      getContextCostPolicy(
        {
          units: [
            {
              name: 'textInput',
              strategy: 'tiered',
              unit: 'millionTokens',
              tiers: [
                { rate: 4, upTo: 100_000 },
                { rate: 2, upTo: 'infinity' },
              ],
            },
          ],
        },
        1_000_000,
      ).pricingBoundary,
    ).toBeUndefined();
  });
});
