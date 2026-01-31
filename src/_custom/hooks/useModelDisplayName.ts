import { aiModelSelectors, useAiInfraStore } from '@/store/aiInfra';

export const useModelDisplayName = (model?: string, provider?: string) => {
  return useAiInfraStore((s) => {
    if (!model) return '';

    const enabledModel = aiModelSelectors.getEnabledModelById(model, provider ?? '')(s);
    if (enabledModel?.displayName) return enabledModel.displayName;

    const builtinModel = s.builtinAiModelList.find(
      (item) => item.id === model && (!provider || item.providerId === provider),
    );

    return builtinModel?.displayName || model;
  });
};
