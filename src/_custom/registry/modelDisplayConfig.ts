import type {
  ModelDisplayConfig,
  ModelDisplayDefaults,
  ModelDisplayItem,
  ModelDisplayModelRef,
  ModelDisplayScope,
} from '@/types/modelDisplay';

interface ModelLike {
  displayName?: string;
  id: string;
}

interface ProviderModelListLike<T extends ModelLike> {
  children: T[];
  id: string;
}

const normalizeModelKey = (provider: string, model: string) =>
  `${provider.trim().toLowerCase()}/${model.trim().toLowerCase()}`;

export const COTTI_MODEL_DISPLAY_DEFAULTS = {
  agent: { model: 'gemini-3.7-flash', provider: 'vertexai' },
  chat: { model: 'gemini-3.5-flash-lite', provider: 'vertexai' },
} as const satisfies Required<ModelDisplayDefaults>;

export const normalizeModelDisplayRef = (
  modelRef: ModelDisplayModelRef | undefined,
): ModelDisplayModelRef | undefined => {
  if (!modelRef) return;

  const model = modelRef.model.trim();
  const provider = modelRef.provider.trim();
  if (!model || !provider) return;

  return { model, provider };
};

export const isModelEnabledInDisplayScope = (
  config: ModelDisplayConfig,
  scope: ModelDisplayScope,
  modelRef: ModelDisplayModelRef,
) => {
  const key = normalizeModelKey(modelRef.provider, modelRef.model);

  return config[scope].some(
    (item) => item.enabled && normalizeModelKey(item.provider, item.model) === key,
  );
};

export const isSameModelDisplayRef = (left: ModelDisplayModelRef, right: ModelDisplayModelRef) =>
  normalizeModelKey(left.provider, left.model) === normalizeModelKey(right.provider, right.model);

export const getModelDisplayDefault = (
  config: ModelDisplayConfig,
  scope: ModelDisplayScope,
): ModelDisplayModelRef | undefined => {
  const configuredDefault = normalizeModelDisplayRef(config.defaults?.[scope]);
  const defaultModel = configuredDefault || COTTI_MODEL_DISPLAY_DEFAULTS[scope];

  return isModelEnabledInDisplayScope(config, scope, defaultModel) ? defaultModel : undefined;
};

export const isModelAvailableInProviderLists = <
  T extends ModelLike,
  P extends ProviderModelListLike<T>,
>(
  providers: P[],
  modelRef: ModelDisplayModelRef,
) => {
  const key = normalizeModelKey(modelRef.provider, modelRef.model);

  return providers.some((provider) =>
    provider.children.some((model) => normalizeModelKey(provider.id, model.id) === key),
  );
};

export const resolveModelDisplayTargetModel = <
  T extends ModelLike,
  P extends ProviderModelListLike<T>,
>({
  availableModels,
  config,
  currentModel,
  targetScope,
}: {
  availableModels: P[];
  config: ModelDisplayConfig;
  currentModel: ModelDisplayModelRef;
  targetScope: ModelDisplayScope;
}): ModelDisplayModelRef | undefined => {
  if (
    isModelEnabledInDisplayScope(config, targetScope, currentModel) &&
    isModelAvailableInProviderLists(availableModels, currentModel)
  ) {
    return normalizeModelDisplayRef(currentModel);
  }

  const defaultModel = getModelDisplayDefault(config, targetScope);
  if (!defaultModel || !isModelAvailableInProviderLists(availableModels, defaultModel)) return;

  return defaultModel;
};

export const applyModelDisplayConfig = <T extends ModelLike, P extends ProviderModelListLike<T>>(
  providers: P[],
  items: ModelDisplayItem[] | undefined,
) => {
  if (!items) return;

  const enabledItems = items.filter((item) => item.enabled);
  const enabledItemMap = new Map(
    enabledItems.map((item) => [normalizeModelKey(item.provider, item.model), item]),
  );
  const order = new Map(
    enabledItems.map((item, index) => [normalizeModelKey(item.provider, item.model), index]),
  );

  return providers
    .map((provider) => ({
      ...provider,
      children: provider.children
        .filter((model) => enabledItemMap.has(normalizeModelKey(provider.id, model.id)))
        .map((model) => {
          const item = enabledItemMap.get(normalizeModelKey(provider.id, model.id));
          const displayName = item?.displayName?.trim();

          return displayName ? { ...model, displayName } : model;
        })
        .sort(
          (a, b) =>
            (order.get(normalizeModelKey(provider.id, a.id)) ?? Number.MAX_SAFE_INTEGER) -
            (order.get(normalizeModelKey(provider.id, b.id)) ?? Number.MAX_SAFE_INTEGER),
        ),
    }))
    .filter((provider) => provider.children.length > 0)
    .sort(
      (a, b) =>
        (order.get(normalizeModelKey(a.id, a.children[0]?.id || '')) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(normalizeModelKey(b.id, b.children[0]?.id || '')) ?? Number.MAX_SAFE_INTEGER),
    );
};
