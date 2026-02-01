import { resolveModelDisplayName } from '@/_custom/registry/modelDisplayName';
import { useAiInfraStore } from '@/store/aiInfra';

export const useModelDisplayName = (model?: string, provider?: string) =>
  useAiInfraStore(() => {
    if (!model) return '';
    return resolveModelDisplayName(model, provider);
  });
