import { lambdaClient } from '@/libs/trpc/client';
import type { ModelDisplayConfig, ModelDisplayOption } from '@/types/modelDisplay';

class ModelDisplayClientService {
  getDetail = async (): Promise<ModelDisplayConfig> => {
    return lambdaClient.modelDisplay.detail.query();
  };

  getOptions = async (): Promise<ModelDisplayOption[]> => {
    return lambdaClient.modelDisplay.options.query();
  };

  update = async (config: ModelDisplayConfig) => {
    return lambdaClient.modelDisplay.update.mutate(config);
  };
}

export const modelDisplayService = new ModelDisplayClientService();
