import type { CottiProfessionalModelId } from '@/_custom/registry/modelDisplayConfig';
import { lambdaClient } from '@/libs/trpc/client';
import type {
  CottiProfessionalModelStatus,
  CottiProfessionalModelSwitchResult,
  ModelDisplayConfig,
  ModelDisplayModelRef,
  ModelDisplayOption,
} from '@/types/modelDisplay';

class CottiModelDisplayService {
  previewTaskMigration = async (source: ModelDisplayModelRef) =>
    (await lambdaClient.cotti.modelDisplay.taskMigrationPreview.query(source)).data;

  retireAndMigrateTasks = async (input: {
    source: ModelDisplayModelRef;
    target: ModelDisplayModelRef;
    revision: string;
  }) => (await lambdaClient.cotti.modelDisplay.retireAndMigrateTasks.mutate(input)).data;

  getConfig = async (): Promise<ModelDisplayConfig> => {
    const response = await lambdaClient.cotti.modelDisplay.detail.query();

    return response.data;
  };

  getOptions = async (): Promise<ModelDisplayOption[]> => {
    const response = await lambdaClient.cotti.modelDisplay.options.query();

    return response.data;
  };

  getProfessionalModelStatus = async (): Promise<CottiProfessionalModelStatus> => {
    const response = await lambdaClient.cotti.modelDisplay.professionalModel.query();

    return response.data;
  };

  switchProfessionalModel = async (
    model: CottiProfessionalModelId,
  ): Promise<CottiProfessionalModelSwitchResult> => {
    const response = await lambdaClient.cotti.modelDisplay.switchProfessionalModel.mutate({
      model,
    });

    return response.data;
  };

  updateConfig = async (config: ModelDisplayConfig): Promise<ModelDisplayConfig> => {
    const response = await lambdaClient.cotti.modelDisplay.update.mutate(config);

    return response.data.config;
  };
}

export const cottiModelDisplayService = new CottiModelDisplayService();
