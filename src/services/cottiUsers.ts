import { lambdaClient } from '@/libs/trpc/client';

export const cottiUsersService = {
  list: (input: {
    page: number;
    pageSize: number;
    query?: string;
    vip?: boolean;
    agentEnabled?: boolean;
  }) => lambdaClient.cotti.users.list.query(input),
  mine: () => lambdaClient.cotti.users.mine.query(),
  update: (input: {
    userId: string;
    vip?: boolean;
    agentEnabled?: boolean;
    topicLimitFen?: number | null;
  }) => lambdaClient.cotti.users.update.mutate(input),
};
