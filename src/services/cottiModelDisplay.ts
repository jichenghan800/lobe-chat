import { lambdaClient } from '@/libs/trpc/client';
import type { ModelDisplayConfig, ModelDisplayOption } from '@/types/modelDisplay';

class CottiModelDisplayService {
  getConfig = async (): Promise<ModelDisplayConfig> => {
    const response = await lambdaClient.cotti.modelDisplay.detail.query();

    return response.data;
  };

  getOptions = async (): Promise<ModelDisplayOption[]> => {
    const response = await lambdaClient.cotti.modelDisplay.options.query();

    return response.data;
  };

  updateConfig = async (config: ModelDisplayConfig): Promise<ModelDisplayConfig> => {
    const response = await lambdaClient.cotti.modelDisplay.update.mutate(config);

    return response.data.config;
  };
}

export const cottiModelDisplayService = new CottiModelDisplayService();
