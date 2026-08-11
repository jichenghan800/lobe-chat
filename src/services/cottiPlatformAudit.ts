import { lambdaClient } from '@/libs/trpc/client';
import type { CottiPlatformAuditQuery } from '@/types/cotti/platformAudit';

class CottiPlatformAuditClientService {
  analyzeMessageRisk = async (messageId: string, force?: boolean) => {
    const response = await lambdaClient.cotti.platformAudit.analyzeMessageRisk.mutate({
      force,
      messageId,
    });

    return response.data;
  };

  getDashboard = async (query: CottiPlatformAuditQuery) => {
    const response = await lambdaClient.cotti.platformAudit.dashboard.query(query, {
      context: { showNotification: false },
    });

    return response.data;
  };

  getMessageDetail = async (messageId: string) => {
    const response = await lambdaClient.cotti.platformAudit.messageDetail.query(
      { messageId },
      { context: { showNotification: false } },
    );

    return response.data;
  };
}

export const cottiPlatformAuditService = new CottiPlatformAuditClientService();
