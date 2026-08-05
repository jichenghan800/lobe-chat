import { lambdaClient } from '@/libs/trpc/client';
import type { CottiHomeNotificationConfig } from '@/types/cotti/homeNotification';

class CottiHomeNotificationService {
  getConfig = async (): Promise<CottiHomeNotificationConfig> => {
    const response = await lambdaClient.cotti.homeNotification.detail.query();

    return response.data;
  };

  updateConfig = async (
    config: CottiHomeNotificationConfig,
  ): Promise<CottiHomeNotificationConfig> => {
    const response = await lambdaClient.cotti.homeNotification.update.mutate(config);

    return response.data;
  };
}

export const cottiHomeNotificationService = new CottiHomeNotificationService();
