import type { Pricing } from 'model-bank';

/** Input-price tiers are evaluated on all input, including cache hits. */
export const getContextCostPolicy = (
  pricing?: Pricing,
  capacity?: number,
  model?: { id: string; provider: string },
) => {
  // Independent request ceiling; never changes native compression or model capacity.
  if (model?.id === 'gemini-3.8-flash' && model.provider === 'vertexai')
    return {
      freezeTokenLimit: 1_000_000,
      inputTokenLimit: 1_000_000,
      pricingBoundary: undefined,
      warningTokenLimit: 100_000,
    };
  const boundaries = (pricing?.units ?? []).flatMap((unit) => {
    if (unit.strategy !== 'tiered' || !unit.name.startsWith('textInput')) return [];
    return unit.tiers.flatMap((tier, index) => {
      const next = unit.tiers[index + 1];
      return typeof tier.upTo === 'number' && tier.upTo > 0 && next && next.rate > tier.rate
        ? [tier.upTo]
        : [];
    });
  });
  const pricingBoundary = boundaries.length ? Math.min(...boundaries) : undefined;
  const window = capacity && Number.isFinite(capacity) && capacity > 0 ? capacity : 128_000;
  // Unknown prices still get a platform budget; this is not a claimed billing tier.
  const budget = Math.min(window, pricingBoundary ?? 272_000);
  return {
    freezeTokenLimit: Math.floor(Math.min(window * 0.5, budget * 0.7)),
    inputTokenLimit: Math.floor(budget * 0.85),
    pricingBoundary,
    warningTokenLimit: Math.floor(Math.min(100_000, budget * 0.5)),
  };
};
