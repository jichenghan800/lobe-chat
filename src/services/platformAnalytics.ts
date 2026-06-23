import { lambdaClient } from '@/libs/trpc/client';
import type { PlatformAnalyticsQuery, PlatformAnalyticsRange } from '@/types/platformAnalytics';

class PlatformAnalyticsClientService {
  getDashboard = async (params: PlatformAnalyticsQuery) => {
    return lambdaClient.platformAnalytics.dashboard.query(params);
  };

  getFeedback = async (range: PlatformAnalyticsRange) => {
    return lambdaClient.platformAnalytics.feedback.query({ range });
  };
}

export const platformAnalyticsService = new PlatformAnalyticsClientService();
