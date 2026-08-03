import { lambdaClient } from '@/libs/trpc/client';
import type {
  CottiPlatformAnalyticsAgentErrorsQuery,
  CottiPlatformAnalyticsAgentsQuery,
  CottiPlatformAnalyticsChatErrorsQuery,
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

  getAgentErrors = async (query: CottiPlatformAnalyticsAgentErrorsQuery) => {
    const response = await lambdaClient.cotti.platformAnalytics.agentErrors.query(query, {
      context: { showNotification: false },
    });

    return response.data;
  };

  getAgents = async (query: CottiPlatformAnalyticsAgentsQuery) => {
    const response = await lambdaClient.cotti.platformAnalytics.agents.query(query, {
      context: { showNotification: false },
    });

    return response.data;
  };

  getChatErrors = async (query: CottiPlatformAnalyticsChatErrorsQuery) => {
    const response = await lambdaClient.cotti.platformAnalytics.chatErrors.query(query, {
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

  getFeatures = async (query: CottiPlatformAnalyticsQuery) => {
    const response = await lambdaClient.cotti.platformAnalytics.features.query(query, {
      context: { showNotification: false },
    });

    return response.data;
  };
}

export const cottiPlatformAnalyticsService = new CottiPlatformAnalyticsClientService();
