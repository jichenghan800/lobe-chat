// A cost-oriented reminder, independent of a provider's long-context pricing boundary.
export const shouldWarnLongTopic = (total: number, capacity: number) => {
  if (!Number.isFinite(total) || total <= 0) return false;
  const threshold =
    Number.isFinite(capacity) && capacity > 0 ? Math.min(100_000, capacity * 0.5) : 100_000;
  return total >= threshold;
};
