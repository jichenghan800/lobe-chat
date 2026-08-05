import isEqual from 'fast-deep-equal';

import { useCottiModelDisplayConfig } from '@/_custom/hooks/useCottiModelDisplayConfig';
import { applyModelDisplayConfig } from '@/_custom/registry/modelDisplayConfig';
import { useAiInfraStore } from '@/store/aiInfra';
import { type EnabledProviderWithModels } from '@/types/aiProvider';
import type { ModelDisplayScope } from '@/types/modelDisplay';

export const useEnabledChatModels = (scope?: ModelDisplayScope): EnabledProviderWithModels[] => {
  const enabledChatModelList = useAiInfraStore((s) => s.enabledChatModelList, isEqual);
  const { data: modelDisplayConfig } = useCottiModelDisplayConfig(!!scope);
  const enabledList = enabledChatModelList || [];
  const configuredList = applyModelDisplayConfig(
    enabledList,
    scope ? modelDisplayConfig?.[scope] : undefined,
  );

  return configuredList ?? enabledList;
};
