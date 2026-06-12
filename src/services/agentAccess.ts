import { lambdaClient } from '@/libs/trpc/client';
import type { AgentAccessMode, AgentAccessRuleType } from '@/types/agentAccess';

class AgentAccessClientService {
  getDetail = async () => {
    return lambdaClient.agentAccess.detail.query();
  };

  removeRule = async (id: string) => {
    return lambdaClient.agentAccess.removeRule.mutate({ id });
  };

  setMode = async (mode: AgentAccessMode) => {
    return lambdaClient.agentAccess.setMode.mutate({ mode });
  };

  setRuleEnabled = async (id: string, enabled: boolean) => {
    return lambdaClient.agentAccess.setRuleEnabled.mutate({ enabled, id });
  };

  upsertRule = async (params: { note?: string; type: AgentAccessRuleType; value: string }) => {
    return lambdaClient.agentAccess.upsertRule.mutate(params);
  };
}

export const agentAccessService = new AgentAccessClientService();
