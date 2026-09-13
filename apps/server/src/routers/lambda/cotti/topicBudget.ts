import { z } from 'zod';

import { CottiTopicBudgetModel } from '@/database/models/cottiTopicBudget';
import { router } from '@/libs/trpc/lambda';

import { cottiAdminProcedure } from './procedure';

const procedure = cottiAdminProcedure.use(async (opts) =>
  opts.next({
    ctx: { topicBudgetModel: new CottiTopicBudgetModel(opts.ctx.serverDB) },
  }),
);

export const cottiTopicBudgetRouter = router({
  detail: procedure.query(async ({ ctx }) => ctx.topicBudgetModel.getConfig()),
  update: procedure
    .input(z.object({ enabled: z.boolean(), limitFen: z.number().int().min(1).max(100_000_000) }))
    .mutation(async ({ ctx, input }) =>
      ctx.topicBudgetModel.updateConfig(input, ctx.platformAdmin.userId),
    ),
});
