import { lambdaClient } from '@/libs/trpc/client';
import type { HomeNotificationConfig } from '@/types/homeNotification';

class HomeNotificationClientService {
  getDetail = async (): Promise<HomeNotificationConfig> => {
    return lambdaClient.homeNotification.detail.query();
  };

  update = async (config: HomeNotificationConfig) => {
    return lambdaClient.homeNotification.update.mutate(config);
  };
}

export const homeNotificationService = new HomeNotificationClientService();
