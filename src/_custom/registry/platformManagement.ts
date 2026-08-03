const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

export const resolveCottiPlatformAnalyticsEnabled = (raw: string | undefined) => {
  const normalized = raw?.trim().toLowerCase();
  if (!normalized) return false;

  return !FALSE_VALUES.has(normalized);
};

export const isCottiPlatformAnalyticsEnabled = () =>
  resolveCottiPlatformAnalyticsEnabled(process.env.NEXT_PUBLIC_COTTI_SHOW_PLATFORM_ANALYTICS);
