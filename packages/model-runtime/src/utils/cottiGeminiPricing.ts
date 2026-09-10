import type { Pricing } from 'model-bank';

/** Global standard list prices, USD / 1M tokens; verified 2026-09-10.
 * https://cloud.google.com/vertex-ai/generative-ai/pricing
 * Promotional credits are account-level rebates, not per-call usage charges.
 * Explicit cache storage and grounding are outside this token-only estimate.
 */
export const cottiGemini38Pricing: Pricing = {
  currency: 'USD',
  units: [
    { name: 'textInput', rate: 1.5, strategy: 'fixed', unit: 'millionTokens' },
    { name: 'imageInput', rate: 1.5, strategy: 'fixed', unit: 'millionTokens' },
    { name: 'videoInput', rate: 1.5, strategy: 'fixed', unit: 'millionTokens' },
    { name: 'audioInput', rate: 1.5, strategy: 'fixed', unit: 'millionTokens' },
    { name: 'textInput_cacheRead', rate: 0.15, strategy: 'fixed', unit: 'millionTokens' },
    { name: 'textOutput', rate: 7.5, strategy: 'fixed', unit: 'millionTokens' },
  ],
};
