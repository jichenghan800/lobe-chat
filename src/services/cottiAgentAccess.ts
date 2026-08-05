import { lambdaClient } from '@/libs/trpc/client';
import type {
  CottiAgentAccessDetail,
  CottiAgentAccessMode,
  CottiAgentAccessRuleType,
  CottiAgentAccessUserSuggestion,
} from '@/types/cotti/agentAccess';

export interface CottiAgentModeVisibilityStatus {
  visible: boolean;
}

class CottiAgentAccessService {
  getDetail = async (): Promise<CottiAgentAccessDetail> => {
    const response = await lambdaClient.cotti.agentAccess.detail.query();

    return response.data;
  };

  getStatus = async (): Promise<CottiAgentModeVisibilityStatus> => {
    const response = await lambdaClient.cotti.agentAccess.status.query();

    return response.data;
  };

  removeRule = async (id: string) => {
    return lambdaClient.cotti.agentAccess.removeRule.mutate({ id });
  };

  searchUsers = async (query: string): Promise<CottiAgentAccessUserSuggestion[]> => {
    const response = await lambdaClient.cotti.agentAccess.searchUsers.query({ query });

    return response.data;
  };

  setMode = async (mode: CottiAgentAccessMode) => {
    return lambdaClient.cotti.agentAccess.setMode.mutate({ mode });
  };

  setRuleEnabled = async (id: string, enabled: boolean) => {
    return lambdaClient.cotti.agentAccess.setRuleEnabled.mutate({ enabled, id });
  };

  upsertRule = async (params: { note?: string; type: CottiAgentAccessRuleType; value: string }) => {
    return lambdaClient.cotti.agentAccess.upsertRule.mutate(params);
  };
}

export const cottiAgentAccessService = new CottiAgentAccessService();
