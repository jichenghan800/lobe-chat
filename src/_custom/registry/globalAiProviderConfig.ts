import type { ServerLanguageModel, ServerModelProviderConfig } from '@/types/serverConfig';

interface ParsedVisibleModelAllowList {
  modelIds: Set<string>;
  providerIds: Set<string>;
  providerModelIds: Set<string>;
}

const normalize = (value: string) => value.trim().toLowerCase();

const parseVisibleModelAllowList = (raw = process.env.NEXT_PUBLIC_MODEL_VISIBLE_ALLOW) => {
  if (!raw?.trim()) return;

  const allowList: ParsedVisibleModelAllowList = {
    modelIds: new Set(),
    providerIds: new Set(),
    providerModelIds: new Set(),
  };

  for (const entry of raw.split(/[,;]/)) {
    const normalizedEntry = normalize(entry);
    if (!normalizedEntry) continue;

    if (!normalizedEntry.includes('/')) {
      allowList.modelIds.add(normalizedEntry);
      continue;
    }

    const [providerId, ...modelParts] = normalizedEntry.split('/');
    const modelId = modelParts.join('/');
    if (!providerId || !modelId) continue;

    allowList.providerIds.add(providerId);
    allowList.providerModelIds.add(`${providerId}/${modelId}`);
  }

  if (
    allowList.modelIds.size === 0 &&
    allowList.providerIds.size === 0 &&
    allowList.providerModelIds.size === 0
  ) {
    return;
  }

  return allowList;
};

const isAllowedModel = (
  allowList: ParsedVisibleModelAllowList,
  providerId: string,
  modelId: string,
) => {
  const normalizedProviderId = normalize(providerId);
  const normalizedModelId = normalize(modelId);

  return (
    allowList.modelIds.has(normalizedModelId) ||
    allowList.providerModelIds.has(`${normalizedProviderId}/${normalizedModelId}`)
  );
};

const pruneProviderConfig = (
  providerId: string,
  providerConfig: ServerModelProviderConfig,
  allowList: ParsedVisibleModelAllowList,
): ServerModelProviderConfig | undefined => {
  const serverModelLists = providerConfig.serverModelLists?.filter((model) =>
    isAllowedModel(allowList, providerId, model.id),
  );
  const enabledModels = providerConfig.enabledModels?.filter((modelId) =>
    isAllowedModel(allowList, providerId, modelId),
  );

  if (!serverModelLists?.length && !enabledModels?.length) return;

  return {
    ...providerConfig,
    enabledModels,
    serverModelLists,
  };
};

export const pruneGlobalAiProviderConfig = (
  aiProvider: ServerLanguageModel,
): ServerLanguageModel => {
  const allowList = parseVisibleModelAllowList();
  if (!allowList || !aiProvider) return aiProvider;

  const nextAiProvider: ServerLanguageModel = {};

  for (const [providerId, providerConfig] of Object.entries(aiProvider)) {
    if (!providerConfig) continue;

    const normalizedProviderId = normalize(providerId);
    if (!allowList.providerIds.has(normalizedProviderId) && allowList.modelIds.size === 0) continue;

    const prunedConfig = pruneProviderConfig(providerId, providerConfig, allowList);
    if (prunedConfig) {
      nextAiProvider[providerId as keyof ServerLanguageModel] = prunedConfig;
    }
  }

  return nextAiProvider;
};
