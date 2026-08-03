import { useClientDataSWR } from '@/libs/swr';
import { cottiAgentAccessService } from '@/services/cottiAgentAccess';

const COTTI_AGENT_MODE_VISIBILITY_KEY = 'COTTI_AGENT_MODE_VISIBILITY';

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
  const { data, error, isLoading, mutate } = useClientDataSWR(COTTI_AGENT_MODE_VISIBILITY_KEY, () =>
    cottiAgentAccessService.getStatus(),
  );

  return {
    error,
    isLoading: isLoading && data === undefined,
    isResolved: data !== undefined,
    mutate,
    visible: data?.visible ?? false,
  };
};

export const useBusinessCanEnableAgentMode = (_agentId: string): boolean =>
  useBusinessAgentModeVisibility().visible;

export const useBusinessAgentModeSync = (_agentId: string): void => {};
