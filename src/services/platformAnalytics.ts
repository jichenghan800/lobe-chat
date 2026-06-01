import { lambdaClient } from '@/libs/trpc/client';
import type { PlatformAnalyticsRange } from '@/types/platformAnalytics';

class PlatformAnalyticsClientService {
  getDashboard = async (range: PlatformAnalyticsRange) => {
    return lambdaClient.platformAnalytics.dashboard.query({ range });
  };
}

export const platformAnalyticsService = new PlatformAnalyticsClientService();
