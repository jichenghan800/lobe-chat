import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { CottiSandboxModel } from '@/database/models/cottiSandbox';
import { sandboxEnv } from '@/envs/sandbox';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';

import { cottiAdminProcedure } from './procedure';

const procedure = cottiAdminProcedure.use(async (opts) =>
  opts.next({
    ctx: { sandboxModel: new CottiSandboxModel(opts.ctx.serverDB) },
  }),
);

const userProcedure = authedProcedure
  .use(serverDatabase)
  .use(async (opts) =>
    opts.next({ ctx: { sandboxModel: new CottiSandboxModel(opts.ctx.serverDB) } }),
  );

export const cottiSandboxRouter = router({
  availability: authedProcedure.query(() => ({
    selfHostedAvailable: Boolean(
      sandboxEnv.ONLYBOXES_ENABLED &&
      sandboxEnv.ONLYBOXES_BASE_URL &&
      sandboxEnv.ONLYBOXES_JIT_SIGNING_KEY,
    ),
  })),
  detail: procedure.query(async ({ ctx }) => ({
    ...(await ctx.sandboxModel.getConfig()),
    active: Boolean(
      sandboxEnv.ONLYBOXES_ENABLED &&
      sandboxEnv.ONLYBOXES_BASE_URL &&
      sandboxEnv.ONLYBOXES_JIT_SIGNING_KEY,
    ),
  })),
  switchUnusedTopic: userProcedure
    .input(z.object({ topicId: z.string(), provider: z.enum(['market', 'onlyboxes']) }))
    .mutation(async ({ ctx, input }) => {
      if (
        input.provider === 'onlyboxes' &&
        !(
          sandboxEnv.ONLYBOXES_ENABLED &&
          sandboxEnv.ONLYBOXES_BASE_URL &&
          sandboxEnv.ONLYBOXES_JIT_SIGNING_KEY
        )
      )
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Self-hosted sandbox is unavailable' });
      return ctx.sandboxModel.switchUnusedTopic(ctx.userId, input.topicId, input.provider);
    }),
  update: procedure
    .input(z.object({ maxSessions: z.number().int().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.sandboxModel.updateConfig(input.maxSessions, ctx.platformAdmin.userId);
      return {
        ...(await ctx.sandboxModel.getConfig()),
        active: Boolean(
          sandboxEnv.ONLYBOXES_ENABLED &&
          sandboxEnv.ONLYBOXES_BASE_URL &&
          sandboxEnv.ONLYBOXES_JIT_SIGNING_KEY,
        ),
      };
    }),
});
