import { lambdaClient } from '@/libs/trpc/client';

export const cottiSandboxService = {
  getAvailability: () => lambdaClient.cotti.sandbox.availability.query(),
  getConfig: () => lambdaClient.cotti.sandbox.detail.query(),
  updateConfig: (maxSessions: number) => lambdaClient.cotti.sandbox.update.mutate({ maxSessions }),
};
