import { useCottiUserPolicy } from '@/_custom/hooks/useCottiUserPolicy';

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

export const useBusinessCanEnableAgentMode = (_agentId: string): boolean =>
  useCottiUserPolicy().data?.agentEnabled ?? false;

export const useBusinessAgentModeSync = (_agentId: string): void => {};
