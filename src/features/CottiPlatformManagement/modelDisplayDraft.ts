import type {
  ModelDisplayConfig,
  ModelDisplayItem,
  ModelDisplayModelRef,
  ModelDisplayOption,
  ModelDisplayScope,
} from '@/types/modelDisplay';

export const getModelDisplayKey = ({ model, provider }: ModelDisplayModelRef) =>
  `${provider.trim().toLowerCase()}\u0000${model.trim().toLowerCase()}`;

const isSameModel = (left: ModelDisplayModelRef, right: ModelDisplayModelRef) =>
  getModelDisplayKey(left) === getModelDisplayKey(right);

const withScope = (
  config: ModelDisplayConfig,
  scope: ModelDisplayScope,
  items: ModelDisplayItem[],
  defaultModel = config.defaults?.[scope],
): ModelDisplayConfig => ({
  ...config,
  [scope]: items,
  defaults: {
    ...config.defaults,
    [scope]: defaultModel,
  },
});

export const addModelDisplayItem = (
  config: ModelDisplayConfig,
  scope: ModelDisplayScope,
  option: ModelDisplayOption,
) => {
  if (config[scope].some((item) => isSameModel(item, option))) return config;

  const item: ModelDisplayItem = {
    displayName: option.displayName,
    enabled: true,
    model: option.model,
    provider: option.provider,
  };
  const defaultModel = config.defaults?.[scope] || {
    model: option.model,
    provider: option.provider,
  };

  return withScope(config, scope, [...config[scope], item], defaultModel);
};

export const setModelDisplayItemEnabled = (
  config: ModelDisplayConfig,
  scope: ModelDisplayScope,
  target: ModelDisplayModelRef,
  enabled: boolean,
): ModelDisplayConfig | undefined => {
  const items = config[scope].map((item) =>
    isSameModel(item, target) ? { ...item, enabled } : item,
  );
  const currentDefault = config.defaults?.[scope];

  if (!enabled && currentDefault && isSameModel(currentDefault, target)) {
    const nextDefault = items.find((item) => item.enabled);
    if (!nextDefault) return;

    return withScope(config, scope, items, {
      model: nextDefault.model,
      provider: nextDefault.provider,
    });
  }

  if (enabled && !currentDefault) {
    return withScope(config, scope, items, {
      model: target.model,
      provider: target.provider,
    });
  }

  return withScope(config, scope, items);
};

export const setModelDisplayName = (
  config: ModelDisplayConfig,
  scope: ModelDisplayScope,
  target: ModelDisplayModelRef,
  displayName: string,
) =>
  withScope(
    config,
    scope,
    config[scope].map((item) => (isSameModel(item, target) ? { ...item, displayName } : item)),
  );

export const setModelDisplayDefault = (
  config: ModelDisplayConfig,
  scope: ModelDisplayScope,
  target: ModelDisplayModelRef,
) =>
  config[scope].some((item) => item.enabled && isSameModel(item, target))
    ? withScope(config, scope, config[scope], target)
    : config;

export const moveModelDisplayItem = (
  config: ModelDisplayConfig,
  scope: ModelDisplayScope,
  index: number,
  direction: -1 | 1,
) => {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= config[scope].length) return config;

  const items = [...config[scope]];
  [items[index], items[targetIndex]] = [items[targetIndex], items[index]];

  return withScope(config, scope, items);
};

export const isModelDisplayDefault = (
  config: ModelDisplayConfig,
  scope: ModelDisplayScope,
  target: ModelDisplayModelRef,
) => {
  const defaultModel = config.defaults?.[scope];

  return Boolean(defaultModel && isSameModel(defaultModel, target));
};
