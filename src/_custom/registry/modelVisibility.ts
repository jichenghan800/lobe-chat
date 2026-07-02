interface ModelLike {
  id: string;
}

interface ProviderModelListLike<T extends ModelLike> {
  children: T[];
  id: string;
}

interface VisibleModelRef {
  model: string;
  provider: string;
}

const DEFAULT_VISIBLE_MODEL_ALLOW =
  'vertexai/gemini-3.1-flash-lite,vertexai/gemini-3.5-flash,volcengine/doubao-seed-2-1-pro-260628,qwen/qwen3.7-plus,azure/gpt-5.5,qwen/glm-5.2';

const parseVisibleModelAllowList = () => {
  const raw = process.env.NEXT_PUBLIC_MODEL_VISIBLE_ALLOW || DEFAULT_VISIBLE_MODEL_ALLOW;

  const modelIds = new Set<string>();
  const order = new Map<string, number>();
  const providerModelIds = new Set<string>();

  const entries = raw
    .split(/[,;]/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  entries.forEach((entry, index) => {
    if (entry.includes('/')) {
      providerModelIds.add(entry);
      order.set(entry, index);
      return;
    }

    modelIds.add(entry);
    order.set(entry, index);
  });

  return { modelIds, order, providerModelIds };
};

const VISIBLE_MODEL_ALLOW_LIST = parseVisibleModelAllowList();

const hasVisibleModelAllowList =
  VISIBLE_MODEL_ALLOW_LIST.modelIds.size > 0 || VISIBLE_MODEL_ALLOW_LIST.providerModelIds.size > 0;

export const isModelVisible = (providerId: string, modelId: string) => {
  if (!hasVisibleModelAllowList) return true;

  const normalizedProviderId = providerId.trim().toLowerCase();
  const normalizedModelId = modelId.trim().toLowerCase();

  return (
    VISIBLE_MODEL_ALLOW_LIST.modelIds.has(normalizedModelId) ||
    VISIBLE_MODEL_ALLOW_LIST.providerModelIds.has(`${normalizedProviderId}/${normalizedModelId}`)
  );
};

export const createModelVisibilityChecker = (refs?: VisibleModelRef[]) => {
  if (!refs) return isModelVisible;

  const allowList = new Set(
    refs
      .map((item) => {
        const provider = item.provider.trim().toLowerCase();
        const model = item.model.trim().toLowerCase();
        if (!provider || !model) return;
        return `${provider}/${model}`;
      })
      .filter(Boolean) as string[],
  );

  if (allowList.size === 0) return () => false;

  return (providerId: string, modelId: string) =>
    allowList.has(`${providerId.trim().toLowerCase()}/${modelId.trim().toLowerCase()}`);
};

const getModelOrder = (providerId: string, modelId: string) => {
  const normalizedProviderId = providerId.trim().toLowerCase();
  const normalizedModelId = modelId.trim().toLowerCase();

  return (
    VISIBLE_MODEL_ALLOW_LIST.order.get(`${normalizedProviderId}/${normalizedModelId}`) ??
    VISIBLE_MODEL_ALLOW_LIST.order.get(normalizedModelId) ??
    Number.MAX_SAFE_INTEGER
  );
};

export const filterVisibleProviderModelLists = <
  T extends ModelLike,
  P extends ProviderModelListLike<T>,
>(
  providers: P[],
  refs?: VisibleModelRef[],
) => {
  if (refs) return filterProviderModelListsByRefs(providers, refs);
  if (!hasVisibleModelAllowList) return providers;

  return providers
    .map((provider) => ({
      ...provider,
      children: provider.children
        .filter((model) => isModelVisible(provider.id, model.id))
        .sort((a, b) => getModelOrder(provider.id, a.id) - getModelOrder(provider.id, b.id)),
    }))
    .filter((provider) => provider.children.length > 0)
    .sort(
      (a, b) =>
        getModelOrder(a.id, a.children[0]?.id || '') - getModelOrder(b.id, b.children[0]?.id || ''),
    );
};

export const filterProviderModelListsByRefs = <
  T extends ModelLike,
  P extends ProviderModelListLike<T>,
>(
  providers: P[],
  refs: VisibleModelRef[],
) => {
  const order = new Map<string, number>();
  const visible = new Set<string>();

  refs.forEach((item, index) => {
    const provider = item.provider.trim().toLowerCase();
    const model = item.model.trim().toLowerCase();
    if (!provider || !model) return;

    const key = `${provider}/${model}`;
    visible.add(key);
    order.set(key, index);
  });

  if (visible.size === 0) return [];

  const getOrder = (providerId: string, modelId: string) =>
    order.get(`${providerId.trim().toLowerCase()}/${modelId.trim().toLowerCase()}`) ??
    Number.MAX_SAFE_INTEGER;

  return providers
    .map((provider) => ({
      ...provider,
      children: provider.children
        .filter((model) =>
          visible.has(`${provider.id.trim().toLowerCase()}/${model.id.trim().toLowerCase()}`),
        )
        .sort((a, b) => getOrder(provider.id, a.id) - getOrder(provider.id, b.id)),
    }))
    .filter((provider) => provider.children.length > 0)
    .sort(
      (a, b) => getOrder(a.id, a.children[0]?.id || '') - getOrder(b.id, b.children[0]?.id || ''),
    );
};
