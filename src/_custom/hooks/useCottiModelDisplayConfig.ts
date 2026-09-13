import { filterModelsForVip } from '@/_custom/registry/userModelAccess';
import { useClientDataSWR } from '@/libs/swr';
import { cottiModelDisplayService } from '@/services/cottiModelDisplay';

import { useCottiUserPolicy } from './useCottiUserPolicy';

const COTTI_MODEL_DISPLAY_CONFIG_KEY = ['cotti', 'model-display-config'] as const;

export const useCottiModelDisplayConfig = (enabled = true, management = false) => {
  const policy = useCottiUserPolicy(enabled && !management);
  const result = useClientDataSWR(
    enabled ? COTTI_MODEL_DISPLAY_CONFIG_KEY : null,
    () => cottiModelDisplayService.getConfig(),
    { revalidateOnFocus: true },
  );
  return {
    ...result,
    data:
      result.data && !management
        ? filterModelsForVip(result.data, policy.data?.vip ?? false)
        : result.data,
  };
};
