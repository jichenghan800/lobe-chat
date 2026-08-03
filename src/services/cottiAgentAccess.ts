import { lambdaClient } from '@/libs/trpc/client';

export interface CottiAgentModeVisibilityStatus {
  visible: boolean;
}

class CottiAgentAccessService {
  getStatus = async (): Promise<CottiAgentModeVisibilityStatus> => {
    const response = await lambdaClient.cotti.agentAccess.status.query();

    return response.data;
  };
}

export const cottiAgentAccessService = new CottiAgentAccessService();
