import isEqual from 'fast-deep-equal';

import { useCottiModelDisplayConfig } from '@/_custom/hooks/useCottiModelDisplayConfig';
import { useCottiUserPolicy } from '@/_custom/hooks/useCottiUserPolicy';
import { applyModelDisplayConfig } from '@/_custom/registry/modelDisplayConfig';
import { isVipModel } from '@/_custom/registry/userModelAccess';
import { useAiInfraStore } from '@/store/aiInfra';
import { type EnabledProviderWithModels } from '@/types/aiProvider';
import type { ModelDisplayScope } from '@/types/modelDisplay';

export const useEnabledChatModels = (scope?: ModelDisplayScope): EnabledProviderWithModels[] => {
  const enabledChatModelList = useAiInfraStore((s) => s.enabledChatModelList, isEqual);
  const { data: modelDisplayConfig } = useCottiModelDisplayConfig(true, true);
  const { data: policy } = useCottiUserPolicy();
  // Wait for both permissions and classification to avoid briefly exposing VIP models.
  const enabledList =
    !modelDisplayConfig || !policy
      ? []
      : (enabledChatModelList || [])
          .map((provider) => ({
            ...provider,
            children: provider.children.filter(
              (model) =>
                policy.vip ||
                !isVipModel(modelDisplayConfig, { provider: provider.id, model: model.id }),
            ),
          }))
          .filter((provider) => provider.children.length > 0);
  const configuredList = applyModelDisplayConfig(
    enabledList,
    scope ? modelDisplayConfig?.[scope] : undefined,
  );

  return configuredList ?? enabledList;
};
