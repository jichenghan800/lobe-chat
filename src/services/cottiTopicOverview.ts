import { lambdaClient } from '@/libs/trpc/client';
import type { CottiTopicOverviewQuery } from '@/types/cotti/topicOverview';

class CottiTopicOverviewClientService {
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
