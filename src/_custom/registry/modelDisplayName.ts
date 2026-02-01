import { aiModelSelectors, getAiInfraStoreState } from '@/store/aiInfra';

export const resolveModelDisplayName = (model?: string, provider?: string) => {
  if (!model) return '';

  const state = getAiInfraStoreState();
  const enabledModel = aiModelSelectors.getEnabledModelById(model, provider ?? '')(state);
  if (enabledModel?.displayName) return enabledModel.displayName;

  const builtinModel = state.builtinAiModelList.find(
    (item) => item.id === model && (!provider || item.providerId === provider),
  );

  return builtinModel?.displayName || model;
};
