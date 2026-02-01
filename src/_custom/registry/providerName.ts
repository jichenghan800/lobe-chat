const parseProviderNameMap = () => {
  const raw = process.env.NEXT_PUBLIC_PROVIDER_NAME_MAP;
  if (!raw) return new Map<string, string>();

  const map = new Map<string, string>();
  const entries = raw
    .split(/[,;]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const delimiterIndex = entry.includes(':') ? entry.indexOf(':') : entry.indexOf('=');
    if (delimiterIndex <= 0) continue;

    const key = entry.slice(0, delimiterIndex).trim().toLowerCase();
    const value = entry.slice(delimiterIndex + 1).trim();
    if (!key || !value) continue;

    map.set(key, value);
  }

  return map;
};

const PROVIDER_NAME_MAP = parseProviderNameMap();

const hasProviderNameMap = PROVIDER_NAME_MAP.size > 0;

export const resolveProviderName = (providerId?: string, fallback?: string) => {
  if (!providerId) return fallback || '';
  if (!hasProviderNameMap) return fallback || providerId;

  const mapped = PROVIDER_NAME_MAP.get(providerId.trim().toLowerCase());
  return mapped || fallback || providerId;
};

export const mapProviderListName = <T extends { id: string; name?: string }>(providers: T[]) => {
  if (!hasProviderNameMap) return providers;

  return providers.map((provider) => ({
    ...provider,
    name: resolveProviderName(provider.id, provider.name || provider.id),
  }));
};
