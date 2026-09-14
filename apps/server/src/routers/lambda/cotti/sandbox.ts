import { z } from 'zod';

import { CottiSandboxModel } from '@/database/models/cottiSandbox';
import { sandboxEnv } from '@/envs/sandbox';
import { router } from '@/libs/trpc/lambda';

import { cottiAdminProcedure } from './procedure';

const procedure = cottiAdminProcedure.use(async (opts) =>
  opts.next({
    ctx: { sandboxModel: new CottiSandboxModel(opts.ctx.serverDB) },
  }),
);

export const cottiSandboxRouter = router({
  detail: procedure.query(async ({ ctx }) => ({
    ...(await ctx.sandboxModel.getConfig()),
    active: sandboxEnv.SANDBOX_PROVIDER === 'onlyboxes',
  })),
  update: procedure
    .input(z.object({ maxSessions: z.number().int().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.sandboxModel.updateConfig(input.maxSessions, ctx.platformAdmin.userId);
      return {
        ...(await ctx.sandboxModel.getConfig()),
        active: sandboxEnv.SANDBOX_PROVIDER === 'onlyboxes',
      };
    }),
});
