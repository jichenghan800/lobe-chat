import isEqual from 'fast-deep-equal';

import { filterAgentOnlyChatModels } from '@/_custom/registry/modelAvailability';
import { normalizeProviderModelDisplayNames } from '@/_custom/registry/modelDisplayName';
import { filterVisibleProviderModelLists } from '@/_custom/registry/modelVisibility';
import { useAiInfraStore } from '@/store/aiInfra';
import { type EnabledProviderWithModels } from '@/types/aiProvider';

interface UseEnabledChatModelsOptions {
  includeAgentOnlyModels?: boolean;
}

export const useEnabledChatModels = ({
  includeAgentOnlyModels = true,
}: UseEnabledChatModelsOptions = {}): EnabledProviderWithModels[] => {
  const enabledChatModelList = useAiInfraStore((s) => s.enabledChatModelList, isEqual);

  const visibleProviderModelLists = filterVisibleProviderModelLists(enabledChatModelList || []);

  return normalizeProviderModelDisplayNames(
    includeAgentOnlyModels
      ? visibleProviderModelLists
      : filterAgentOnlyChatModels(visibleProviderModelLists),
  );
};
