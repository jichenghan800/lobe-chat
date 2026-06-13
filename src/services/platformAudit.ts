import { lambdaClient } from '@/libs/trpc/client';
import type { PlatformAuditQuery } from '@/types/platformAudit';

class PlatformAuditClientService {
  analyzeMessageRisk = async (messageId: string, force?: boolean) => {
    return lambdaClient.platformAudit.analyzeMessageRisk.mutate({ force, messageId });
  };

  getDashboard = async (params: PlatformAuditQuery) => {
    return lambdaClient.platformAudit.dashboard.query(params);
  };

  getMessageDetail = async (messageId: string) => {
    return lambdaClient.platformAudit.messageDetail.query({ messageId });
  };
}

export const platformAuditService = new PlatformAuditClientService();
