import { lambdaClient } from '@/libs/trpc/client';
import type { CottiPlatformAnalyticsQuery } from '@/types/cotti/platformAnalytics';

class CottiPlatformAnalyticsClientService {
  getAccess = async () => {
    const response = await lambdaClient.cotti.admin.getAccess.query(undefined, {
      context: { showNotification: false },
    });

    return response.data;
  };

  getDashboard = async (query: CottiPlatformAnalyticsQuery) => {
    const response = await lambdaClient.cotti.platformAnalytics.dashboard.query(query, {
      context: { showNotification: false },
    });

    return response.data;
  };
}

export const cottiPlatformAnalyticsService = new CottiPlatformAnalyticsClientService();
