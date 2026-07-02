import { filterProviderModelListsByRefs } from './modelVisibility';

interface ModelLike {
  displayName?: string;
  id: string;
}

interface ProviderModelListLike<T extends ModelLike> {
  children: T[];
  id: string;
}

interface ModelDisplayItem {
  displayName?: string;
  enabled: boolean;
  model: string;
  provider: string;
}

const normalizeKey = (provider: string, model: string) =>
  `${provider.trim().toLowerCase()}/${model.trim().toLowerCase()}`;

export const applyModelDisplayConfig = <T extends ModelLike, P extends ProviderModelListLike<T>>(
  providers: P[],
  items: ModelDisplayItem[] | undefined,
) => {
  if (!items) return;

  const enabledItems = items.filter((item) => item.enabled);
  const visibleProviders = filterProviderModelListsByRefs(providers, enabledItems);
  const displayNameMap = new Map(
    enabledItems
      .map((item) => {
        const displayName = item.displayName?.trim();
        if (!displayName) return;

        return [normalizeKey(item.provider, item.model), displayName] as const;
      })
      .filter(Boolean) as [string, string][],
  );

  return visibleProviders.map((provider) => ({
    ...provider,
    children: provider.children.map((model) => {
      const displayName = displayNameMap.get(normalizeKey(provider.id, model.id));

      return displayName ? { ...model, displayName } : model;
    }),
  }));
};
