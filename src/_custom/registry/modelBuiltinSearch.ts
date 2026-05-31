interface SearchModelSettingsLike {
  searchImpl?: unknown;
  searchProvider?: unknown;
  [key: string]: unknown;
}

interface SearchModelLike {
  abilities?: ({ search?: boolean } & Record<string, unknown>) | null;
  id: string;
  providerId?: string;
  settings?: SearchModelSettingsLike | null;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const matchesPattern = (value: string, pattern: string) => {
  const source = pattern
    .split('*')
    .map((part) => escapeRegExp(part))
    .join('.*');

  return new RegExp(`^${source}$`).test(value);
};

const parseBuiltinSearchAllowList = (raw: string | undefined) =>
  (raw || '')
    .split(/[,;]/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

export const isModelBuiltinSearchAllowed = (
  providerId: string | undefined,
  modelId: string,
  rawAllowList = process.env.NEXT_PUBLIC_COTTI_MODEL_BUILTIN_SEARCH_ALLOW,
) => {
  const allowList = parseBuiltinSearchAllowList(rawAllowList);
  if (allowList.length === 0) return true;

  const normalizedModelId = modelId.trim().toLowerCase();
  const normalizedProviderId = providerId?.trim().toLowerCase();
  const providerModelId = normalizedProviderId
    ? `${normalizedProviderId}/${normalizedModelId}`
    : normalizedModelId;

  return allowList.some((entry) => {
    if (entry.includes('/')) return matchesPattern(providerModelId, entry);

    return matchesPattern(normalizedModelId, entry);
  });
};

const removeSearchSettings = (settings: SearchModelSettingsLike | null | undefined) => {
  if (!settings?.searchImpl && !settings?.searchProvider) return settings || undefined;

  const nextSettings = { ...settings };
  delete nextSettings.searchImpl;
  delete nextSettings.searchProvider;

  return Object.keys(nextSettings).length > 0 ? nextSettings : undefined;
};

export const normalizeModelBuiltinSearch = <T extends SearchModelLike>(
  providerId: string,
  model: T,
): T => {
  if (isModelBuiltinSearchAllowed(providerId, model.id)) return model;

  const settings = removeSearchSettings(model.settings);
  const hadBuiltinSearch = model.abilities?.search === true || settings !== model.settings;

  if (!hadBuiltinSearch) return model;

  return {
    ...model,
    abilities: {
      ...(model.abilities || {}),
      search: false,
    },
    settings,
  };
};
