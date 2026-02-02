const parseProviderHideList = () => {
  const raw = process.env.NEXT_PUBLIC_PROVIDER_HIDE;
  if (!raw) return new Set<string>();

  const ids = raw
    .split(/[,;]/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  return new Set(ids);
};

const PROVIDER_HIDE_SET = parseProviderHideList();

export const isProviderHidden = (providerId?: string) => {
  if (!providerId) return false;
  if (PROVIDER_HIDE_SET.size === 0) return false;
  return PROVIDER_HIDE_SET.has(providerId.trim().toLowerCase());
};

export const filterHiddenProviders = <T extends { id: string }>(providers: T[]) => {
  if (PROVIDER_HIDE_SET.size === 0) return providers;
  return providers.filter((provider) => !isProviderHidden(provider.id));
};
