import isEqual from 'fast-deep-equal';

import { normalizeProviderModelDisplayNames } from '@/_custom/registry/modelDisplayName';
import { filterVisibleProviderModelLists } from '@/_custom/registry/modelVisibility';
import { useAiInfraStore } from '@/store/aiInfra';
import { type EnabledProviderWithModels } from '@/types/aiProvider';

export const useEnabledChatModels = (): EnabledProviderWithModels[] => {
  const enabledChatModelList = useAiInfraStore((s) => s.enabledChatModelList, isEqual);

  return normalizeProviderModelDisplayNames(
    filterVisibleProviderModelLists(enabledChatModelList || []),
  );
};
