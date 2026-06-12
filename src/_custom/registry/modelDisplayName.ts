interface ModelLike {
  displayName?: string;
  id: string;
}

interface ProviderModelListLike<T extends ModelLike> {
  children: T[];
  id: string;
}

const DEFAULT_MODEL_DISPLAY_NAMES =
  'vertexai/gemini-3.1-flash-lite=COTTI-快速,vertexai/gemini-3.5-flash=COTTI-专业,volcengine/doubao-seed-1.6-flash=豆包1.6-Flash,qwen/qwen3.7-plus=千问3.7-Plus';

const parseModelDisplayNames = () => {
  const raw = process.env.NEXT_PUBLIC_MODEL_DISPLAY_NAMES || DEFAULT_MODEL_DISPLAY_NAMES;

  const modelNames = new Map<string, string>();
  const providerModelNames = new Map<string, string>();

  const entries = raw
    .split(/[,;]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const separatorIndex = entry.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = entry.slice(0, separatorIndex).trim().toLowerCase();
    const value = entry.slice(separatorIndex + 1).trim();
    if (!key || !value) continue;

    if (key.includes('/')) {
      providerModelNames.set(key, value);
      continue;
    }

    modelNames.set(key, value);
  }

  return { modelNames, providerModelNames };
};

const MODEL_DISPLAY_NAMES = parseModelDisplayNames();

export const getModelDisplayName = (
  providerId: string | undefined,
  modelId: string,
  fallback?: string,
) => {
  const normalizedModelId = modelId.trim().toLowerCase();
  const normalizedProviderId = providerId?.trim().toLowerCase();

  return (
    (normalizedProviderId &&
      MODEL_DISPLAY_NAMES.providerModelNames.get(`${normalizedProviderId}/${normalizedModelId}`)) ||
    MODEL_DISPLAY_NAMES.modelNames.get(normalizedModelId) ||
    fallback ||
    modelId
  );
};

export const normalizeModelDisplayName = <T extends ModelLike>(providerId: string, model: T): T => {
  const displayName = getModelDisplayName(providerId, model.id, model.displayName);

  if (displayName === model.displayName) return model;

  return { ...model, displayName };
};

export const normalizeProviderModelDisplayNames = <
  T extends ModelLike,
  P extends ProviderModelListLike<T>,
>(
  providers: P[],
) =>
  providers.map((provider) => ({
    ...provider,
    children: provider.children.map((model) => normalizeModelDisplayName(provider.id, model)),
  }));
