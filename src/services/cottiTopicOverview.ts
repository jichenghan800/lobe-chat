import { lambdaClient } from '@/libs/trpc/client';
import type {
  CottiTopicManagementInput,
  CottiTopicOverviewQuery,
} from '@/types/cotti/topicOverview';

class CottiTopicOverviewClientService {
  accounting = (topicId: string) => lambdaClient.cotti.topicOverview.accounting.query({ topicId });
  manage = (input: CottiTopicManagementInput) =>
    lambdaClient.cotti.topicOverview.manage.mutate(input);

  getDetail = async (topicId: string) => {
    const response = await lambdaClient.cotti.topicOverview.detail.query(
      { topicId },
      { context: { showNotification: false } },
    );

    return response.data;
  };

  list = async (query: CottiTopicOverviewQuery) => {
    const response = await lambdaClient.cotti.topicOverview.list.query(query, {
      context: { showNotification: false },
    });

    return response.data;
  };
}

export const cottiTopicOverviewService = new CottiTopicOverviewClientService();
