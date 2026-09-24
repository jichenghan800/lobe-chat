import type { TopicSandboxProvider } from '@lobechat/types';

import { lambdaClient } from '@/libs/trpc/client';

export const cottiSandboxService = {
  getAvailability: () => lambdaClient.cotti.sandbox.availability.query(),
  preflight: () => lambdaClient.cotti.sandbox.preflight.query(),
  getConfig: () => lambdaClient.cotti.sandbox.detail.query(),
  switchUnusedTopic: (topicId: string, provider: TopicSandboxProvider) =>
    lambdaClient.cotti.sandbox.switchUnusedTopic.mutate({ topicId, provider }),
  updateConfig: (maxSessions: number) => lambdaClient.cotti.sandbox.update.mutate({ maxSessions }),
};
