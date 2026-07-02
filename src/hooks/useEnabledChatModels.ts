import isEqual from 'fast-deep-equal';

import {
  filterAgentModeModelLists,
  filterChatModeModelLists,
} from '@/_custom/registry/modelAvailability';
import { applyModelDisplayConfig } from '@/_custom/registry/modelDisplayConfig';
import { normalizeProviderModelDisplayNames } from '@/_custom/registry/modelDisplayName';
import { filterVisibleProviderModelLists } from '@/_custom/registry/modelVisibility';
import { useClientDataSWR } from '@/libs/swr';
import { modelDisplayKeys } from '@/libs/swr/keys';
import { modelDisplayService } from '@/services/modelDisplay';
import { useAiInfraStore } from '@/store/aiInfra';
import { type EnabledProviderWithModels } from '@/types/aiProvider';

interface UseEnabledChatModelsOptions {
  includeAgentOnlyModels?: boolean;
}

export const useEnabledChatModels = ({
  includeAgentOnlyModels = true,
}: UseEnabledChatModelsOptions = {}): EnabledProviderWithModels[] => {
  const enabledChatModelList = useAiInfraStore((s) => s.enabledChatModelList, isEqual);
  const { data: modelDisplayConfig } = useClientDataSWR(modelDisplayKeys.detail(), () =>
    modelDisplayService.getDetail(),
  );

  const configuredModelLists = applyModelDisplayConfig(
    enabledChatModelList || [],
    includeAgentOnlyModels ? modelDisplayConfig?.agent : modelDisplayConfig?.chat,
  );

  if (configuredModelLists) return configuredModelLists;

  const visibleProviderModelLists = filterVisibleProviderModelLists(enabledChatModelList || []);

  return normalizeProviderModelDisplayNames(
    includeAgentOnlyModels
      ? filterAgentModeModelLists(visibleProviderModelLists)
      : filterChatModeModelLists(visibleProviderModelLists),
  );
};
