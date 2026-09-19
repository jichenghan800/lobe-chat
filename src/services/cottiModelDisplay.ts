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
  getAdminConfig = async (groupId?: string): Promise<ModelDisplayConfig> =>
    (await lambdaClient.cotti.modelDisplay.adminDetail.query(groupId ? { groupId } : undefined))
      .data;
  previewTaskMigration = async (source: ModelDisplayModelRef, groupId?: string) =>
    (await lambdaClient.cotti.modelDisplay.taskMigrationPreview.query({ ...source, groupId })).data;

  retireAndMigrateTasks = async (input: {
    source: ModelDisplayModelRef;
    target: ModelDisplayModelRef;
    revision: string;
    groupId?: string;
  }) => (await lambdaClient.cotti.modelDisplay.retireAndMigrateTasks.mutate(input)).data;

  getConfig = async (): Promise<ModelDisplayConfig> => {
    const response = await lambdaClient.cotti.modelDisplay.detail.query();

    return response.data;
  };

  getOptions = async (groupId?: string): Promise<ModelDisplayOption[]> => {
    const response = await lambdaClient.cotti.modelDisplay.options.query(
      groupId ? { groupId } : undefined,
    );

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

  updateConfig = async (
    config: ModelDisplayConfig,
    groupId?: string,
  ): Promise<ModelDisplayConfig> => {
    const response = await lambdaClient.cotti.modelDisplay.update.mutate({ ...config, groupId });

    return response.data.config;
  };
}

export const cottiModelDisplayService = new CottiModelDisplayService();
