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
  it('compresses before the price tier even for a million-token model', () => {
    expect(getContextCostPolicy(pricing, 1_050_000)).toMatchObject({
      compressionTokenLimit: 190_400,
      inputTokenLimit: 231_200,
      pricingBoundary: 272_000,
    });
  });
  it('honors smaller model capacity and does not invent a price tier', () => {
    expect(getContextCostPolicy(undefined, 32_000)).toMatchObject({
      compressionTokenLimit: 16_000,
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
