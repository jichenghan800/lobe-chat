import { formatNumber } from '@lobechat/utils';

// Match the existing topic budget/display conversion; never alter stored USD costs.
export const formatCost = (usd: number) => {
  const cny = usd * 7.12;
  return cny > 0 && cny < 0.01 ? '<¥0.01' : `¥${formatNumber(cny, 2)}`;
};
export const formatUsd = (usd: number) => `$${formatNumber(usd, usd > 0 && usd < 0.01 ? 4 : 2)}`;
