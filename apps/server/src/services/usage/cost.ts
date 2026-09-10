import { USD_TO_CNY } from '@lobechat/const';
import { LOBE_DEFAULT_MODEL_LIST, type Pricing, type PricingUnitName } from 'model-bank';

import { type ModelUsage } from '@/types/message';

const PER_MILLION = 1_000_000;

// Pricing is keyed by `provider/model` with an `model`-only fallback so messages
// whose stored provider differs from the model-bank providerId still resolve.
const pricingByKey = new Map<string, Pricing | undefined>();
for (const m of LOBE_DEFAULT_MODEL_LIST) {
  pricingByKey.set(`${m.providerId}/${m.id}`, m.pricing);
  if (!pricingByKey.get(m.id)) pricingByKey.set(m.id, m.pricing);
}

const lookupPricing = (provider?: string | null, model?: string | null): Pricing | undefined => {
  if (!model) return undefined;
  if (provider && pricingByKey.get(`${provider}/${model}`)) {
    return pricingByKey.get(`${provider}/${model}`);
  }
  return pricingByKey.get(model);
};

// Pricing rates live in the model's currency (per million tokens). Normalize to
// USD so every aggregate is comparable regardless of the model's listed currency.
const toUsdRate = (rate: number | undefined, currency?: string): number | undefined =>
  rate === undefined ? undefined : currency === 'CNY' ? rate / USD_TO_CNY : rate;

// Unlike UI price labels, cost attribution must select the tier for the full input size.
const inputTierRate = (
  pricing: Pricing | undefined,
  name: PricingUnitName,
  inputTokens: number,
) => {
  const unit = pricing?.units.find((item) => item.name === name);
  if (!unit || unit.unit !== 'millionTokens') return undefined;
  if (unit.strategy === 'fixed') return unit.rate;
  if (unit.strategy === 'tiered') {
    return (
      unit.tiers.find((tier) => tier.upTo === 'infinity' || inputTokens <= tier.upTo) ??
      unit.tiers.at(-1)
    )?.rate;
  }
  // A lookup (e.g. cache TTL) cannot be recovered from token counts alone.
  return undefined;
};

export interface MessageCostSplit {
  cachedInputCost: number;
  /** Input tokens that missed the cache and were freshly processed. */
  cacheMissTokens: number;
  /** Cached input tokens that were read (cache hits). */
  cacheReadTokens: number;
  /** USD saved by reading from cache instead of paying full input rate. */
  cacheSavings: number;
  cacheWriteCost: number;
  cacheWriteTokens: number;
  /** Input cost for tokens that missed the cache (USD). */
  inputCost: number;
  inputTokens: number;
  outputCost: number;
  outputTokens: number;
  totalCost: number;
  totalTokens: number;
}

/**
 * Split a single assistant message's usage into input / output / cache-write
 * cost + token components, using model-bank pricing. The cost split is scaled to
 * the authoritative billed `storedCost` so per-bucket sums always match the
 * headline cost; when pricing is unknown the whole billed cost falls into input.
 */
export const computeMessageCostSplit = (
  usage: ModelUsage | undefined,
  provider?: string | null,
  model?: string | null,
  storedCost?: number,
): MessageCostSplit => {
  const pricing = lookupPricing(provider, model);
  const currency = pricing?.currency;

  const tierTokens = usage?.totalInputTokens ?? 0;
  const inputRate = toUsdRate(inputTierRate(pricing, 'textInput', tierTokens), currency);
  const cachedRate =
    toUsdRate(inputTierRate(pricing, 'textInput_cacheRead', tierTokens), currency) ?? inputRate;
  const writeRate =
    toUsdRate(inputTierRate(pricing, 'textInput_cacheWrite', tierTokens), currency) ?? inputRate;
  const outputRate = toUsdRate(inputTierRate(pricing, 'textOutput', tierTokens), currency);

  const cacheReadTokens = usage?.inputCachedTokens ?? 0;
  const totalInputTokens = usage?.totalInputTokens ?? 0;
  const toolTokens = usage?.inputToolTokens ?? 0;
  const cacheWriteTokens = usage?.inputWriteCacheTokens ?? 0;
  // Normalized totals already include tool tokens. An explicit miss bucket excludes them.
  const cacheMissTokens =
    usage?.inputCacheMissTokens ??
    Math.max(0, totalInputTokens - cacheReadTokens - cacheWriteTokens - toolTokens);
  const outputTokens = usage?.totalOutputTokens ?? 0;

  let freshInputCost =
    inputRate === undefined ? 0 : ((cacheMissTokens + toolTokens) * inputRate) / PER_MILLION;
  let cacheReadCost = cachedRate === undefined ? 0 : (cacheReadTokens * cachedRate) / PER_MILLION;
  let cacheWriteCost = writeRate === undefined ? 0 : (cacheWriteTokens * writeRate) / PER_MILLION;
  let outputCost = outputRate === undefined ? 0 : (outputTokens * outputRate) / PER_MILLION;
  let computedTotal = freshInputCost + cacheReadCost + cacheWriteCost + outputCost;

  // Reconcile the split with the billed cost so cards == chart.
  if (storedCost !== undefined && Number.isFinite(storedCost) && storedCost >= 0) {
    if (computedTotal > 0) {
      const scale = storedCost / computedTotal;
      freshInputCost *= scale;
      cacheReadCost *= scale;
      cacheWriteCost *= scale;
      outputCost *= scale;
    } else {
      // No pricing data — attribute the whole billed cost to input.
      freshInputCost = storedCost;
    }
    computedTotal = storedCost;
  }

  const cacheSavings =
    inputRate !== undefined && cachedRate !== undefined
      ? Math.max(0, (cacheReadTokens * (inputRate - cachedRate)) / PER_MILLION)
      : 0;

  return {
    cacheMissTokens,
    cacheReadTokens,
    cacheSavings,
    cachedInputCost: cacheReadCost,
    cacheWriteCost,
    cacheWriteTokens,
    inputCost: freshInputCost,
    inputTokens: totalInputTokens,
    outputCost,
    outputTokens,
    totalCost: computedTotal,
    totalTokens: usage?.totalTokens ?? totalInputTokens + outputTokens,
  };
};
