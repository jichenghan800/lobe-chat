import type { CottiLoginAccessMode, CottiLoginAccessRuleType } from '@/database/schemas';
import { lambdaClient } from '@/libs/trpc/client';
import type { CottiPeopleManagementDetail } from '@/types/cotti/peopleManagement';

class CottiPeopleManagementClientService {
  addAdministrator = async (userId: string, note?: string) => {
    return lambdaClient.cotti.peopleManagement.addAdministrator.mutate({ note, userId });
  };

  getDetail = async (): Promise<CottiPeopleManagementDetail> => {
    const response = await lambdaClient.cotti.peopleManagement.detail.query();
    if (!response) throw new Error('People management returned an empty response');
    return response.data;
  };

  removeAdministrator = async (id: string) => {
    return lambdaClient.cotti.peopleManagement.removeAdministrator.mutate({ id });
  };

  removeCottiAiAccessMember = async (id: string) => {
    return lambdaClient.cotti.peopleManagement.removeCottiAiAccessMember.mutate({ id });
  };

  removeLoginRule = async (id: string) => {
    return lambdaClient.cotti.peopleManagement.removeLoginRule.mutate({ id });
  };

  setLoginMode = async (mode: CottiLoginAccessMode) => {
    return lambdaClient.cotti.peopleManagement.setLoginMode.mutate({ mode });
  };

  setCottiAiAccessMemberEnabled = async (id: string, enabled: boolean) => {
    return lambdaClient.cotti.peopleManagement.setCottiAiAccessMemberEnabled.mutate({
      enabled,
      id,
    });
  };

  setLoginRuleEnabled = async (id: string, enabled: boolean) => {
    return lambdaClient.cotti.peopleManagement.setLoginRuleEnabled.mutate({ enabled, id });
  };

  setUserLoginDisabled = async (userId: string, disabled: boolean, reason?: string) => {
    return lambdaClient.cotti.peopleManagement.setUserLoginDisabled.mutate({
      disabled,
      reason,
      userId,
    });
  };

  upsertLoginRule = async (params: {
    note?: string;
    type: CottiLoginAccessRuleType;
    value: string;
  }) => {
    return lambdaClient.cotti.peopleManagement.upsertLoginRule.mutate(params);
  };

  upsertCottiAiAccessMember = async (params: {
    displayName: string;
    email?: string;
    note?: string;
    phone?: string;
  }) => {
    return lambdaClient.cotti.peopleManagement.upsertCottiAiAccessMember.mutate(params);
  };

  updateCottiAiAccessMember = async (
    id: string,
    params: {
      displayName: string;
      email?: string;
      note?: string;
      phone?: string;
    },
  ) => {
    return lambdaClient.cotti.peopleManagement.updateCottiAiAccessMember.mutate({ id, ...params });
  };
}

export const cottiPeopleManagementService = new CottiPeopleManagementClientService();
