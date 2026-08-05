const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

export const resolveCottiPlatformAnalyticsEnabled = (raw: string | undefined) => {
  const normalized = raw?.trim().toLowerCase();
  if (!normalized) return false;

  return !FALSE_VALUES.has(normalized);
};

export const isCottiPlatformAnalyticsEnabled = () =>
  resolveCottiPlatformAnalyticsEnabled(process.env.NEXT_PUBLIC_COTTI_SHOW_PLATFORM_ANALYTICS);

/**
 * The historical public flag is kept for deployment compatibility, but it now
 * gates the complete COTTI platform-management workspace rather than only its
 * analytics section.
 */
export const isCottiPlatformManagementEnabled = isCottiPlatformAnalyticsEnabled;
