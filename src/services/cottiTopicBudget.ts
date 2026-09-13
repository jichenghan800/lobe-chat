import { lambdaClient } from '@/libs/trpc/client';

export const cottiTopicBudgetService = {
  getConfig: () => lambdaClient.cotti.topicBudget.detail.query(),
  updateConfig: (config: { enabled: boolean; limitFen: number }) =>
    lambdaClient.cotti.topicBudget.update.mutate(config),
};
