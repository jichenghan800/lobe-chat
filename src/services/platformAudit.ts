import { lambdaClient } from '@/libs/trpc/client';
import type { PlatformAuditQuery } from '@/types/platformAudit';

class PlatformAuditClientService {
  getDashboard = async (params: PlatformAuditQuery) => {
    return lambdaClient.platformAudit.dashboard.query(params);
  };

  getMessageDetail = async (messageId: string) => {
    return lambdaClient.platformAudit.messageDetail.query({ messageId });
  };
}

export const platformAuditService = new PlatformAuditClientService();
