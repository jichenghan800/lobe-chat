import { lambdaClient } from '@/libs/trpc/client';
import type {
  CottiPlatformAnalyticsChatModelsQuery,
  CottiPlatformAnalyticsChatUsersQuery,
  CottiPlatformAnalyticsQuery,
} from '@/types/cotti/platformAnalytics';

class CottiPlatformAnalyticsClientService {
  getAccess = async () => {
    const response = await lambdaClient.cotti.admin.getAccess.query(undefined, {
      context: { showNotification: false },
    });

    return response.data;
  };

  getChatModels = async (query: CottiPlatformAnalyticsChatModelsQuery) => {
    const response = await lambdaClient.cotti.platformAnalytics.chatModels.query(query, {
      context: { showNotification: false },
    });

    return response.data;
  };

  getChatUsers = async (query: CottiPlatformAnalyticsChatUsersQuery) => {
    const response = await lambdaClient.cotti.platformAnalytics.chatUsers.query(query, {
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
