interface ModelLike {
  id: string;
}

interface ProviderModelListLike<T extends ModelLike> {
  children: T[];
  id: string;
}

const parseVisibleModelAllowList = () => {
  const raw = process.env.NEXT_PUBLIC_MODEL_VISIBLE_ALLOW;
  if (!raw)
    return {
      modelIds: new Set<string>(),
      order: new Map<string, number>(),
      providerModelIds: new Set<string>(),
    };

  const modelIds = new Set<string>();
  const order = new Map<string, number>();
  const providerModelIds = new Set<string>();

  const entries = raw
    .split(/[,;]/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  for (const [index, entry] of entries.entries()) {
    order.set(entry, index);

    if (entry.includes('/')) {
      providerModelIds.add(entry);
      continue;
    }

    modelIds.add(entry);
  }

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

const getVisibleModelOrder = (providerId: string, modelId: string) => {
  const normalizedProviderId = providerId.trim().toLowerCase();
  const normalizedModelId = modelId.trim().toLowerCase();

  return (
    VISIBLE_MODEL_ALLOW_LIST.order.get(`${normalizedProviderId}/${normalizedModelId}`) ??
    VISIBLE_MODEL_ALLOW_LIST.order.get(normalizedModelId) ??
    Number.POSITIVE_INFINITY
  );
};

export const filterVisibleProviderModelLists = <
  T extends ModelLike,
  P extends ProviderModelListLike<T>,
>(
  providers: P[],
) => {
  if (!hasVisibleModelAllowList) return providers;

  return providers
    .map((provider) => {
      const children = provider.children
        .filter((model) => isModelVisible(provider.id, model.id))
        .sort(
          (a, b) =>
            getVisibleModelOrder(provider.id, a.id) - getVisibleModelOrder(provider.id, b.id),
        );

      return { ...provider, children };
    })
    .filter((provider) => provider.children.length > 0)
    .sort((a, b) => {
      const aOrder = Math.min(...a.children.map((model) => getVisibleModelOrder(a.id, model.id)));
      const bOrder = Math.min(...b.children.map((model) => getVisibleModelOrder(b.id, model.id)));

      return aOrder - bOrder;
    });
};
