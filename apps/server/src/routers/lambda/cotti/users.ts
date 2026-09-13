import { z } from 'zod';

import { CottiUserPolicyModel } from '@/database/models/cottiUserPolicy';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';

import { cottiAdminProcedure } from './procedure';

const admin = cottiAdminProcedure.use(async (opts) =>
  opts.next({ ctx: { userPolicyModel: new CottiUserPolicyModel(opts.ctx.serverDB) } }),
);
const member = authedProcedure
  .use(serverDatabase)
  .use(async (opts) =>
    opts.next({ ctx: { userPolicyModel: new CottiUserPolicyModel(opts.ctx.serverDB) } }),
  );
export const cottiUsersRouter = router({
  list: admin
    .input(
      z.object({
        page: z.number().int().min(1),
        pageSize: z.number().int().min(1).max(100),
        query: z.string().trim().max(200).optional(),
        vip: z.boolean().optional(),
        agentEnabled: z.boolean().optional(),
      }),
    )
    .query(({ ctx, input }) => ctx.userPolicyModel.list(input)),
  mine: member.query(({ ctx }) => ctx.userPolicyModel.get(ctx.userId)),
  update: admin
    .input(
      z
        .object({
          userId: z.string().min(1),
          vip: z.boolean().optional(),
          agentEnabled: z.boolean().optional(),
          topicLimitFen: z.number().int().min(1).max(100_000_000).nullable().optional(),
        })
        .refine(
          (value) =>
            value.vip !== undefined ||
            value.agentEnabled !== undefined ||
            value.topicLimitFen !== undefined,
          { message: 'At least one policy field is required' },
        ),
    )
    .mutation(({ ctx, input: { userId, ...policy } }) =>
      ctx.userPolicyModel.update(userId, policy, ctx.platformAdmin.userId),
    ),
});
