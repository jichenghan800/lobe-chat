import { mutate, useClientDataSWR } from '@/libs/swr';
import { cottiAgentAccessService } from '@/services/cottiAgentAccess';

export const COTTI_AGENT_MODE_VISIBILITY_KEY = 'COTTI_AGENT_MODE_VISIBILITY';

export const refreshBusinessAgentModeVisibility = () => mutate(COTTI_AGENT_MODE_VISIBILITY_KEY);

export interface BusinessModelModeConfig {
  chatConfig?: {
    enableAgentMode?: boolean;
  };
  model: string;
  provider: string;
}

export const useBusinessModelModeConfig = () => {
  return <T extends BusinessModelModeConfig>(config: T): T => config;
};

export const useBusinessAgentModeVisibility = () => {
  const {
    data,
    error,
    isLoading,
    mutate: refresh,
  } = useClientDataSWR(COTTI_AGENT_MODE_VISIBILITY_KEY, () => cottiAgentAccessService.getStatus(), {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  });

  return {
    error,
    isLoading: isLoading && data === undefined,
    isResolved: data !== undefined,
    mutate: refresh,
    visible: data?.visible ?? false,
  };
};

export const useBusinessCanEnableAgentMode = (_agentId: string): boolean =>
  useBusinessAgentModeVisibility().visible;

export const useBusinessAgentModeSync = (_agentId: string): void => {};
