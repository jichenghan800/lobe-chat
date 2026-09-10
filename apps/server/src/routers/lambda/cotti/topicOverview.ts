import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { router } from '@/libs/trpc/lambda';
import {
  cottiTopicOverviewQuerySchema,
  CottiTopicOverviewService,
} from '@/server/services/cotti/topicOverview';

import { cottiAdminProcedure } from './procedure';

const cottiTopicOverviewProcedure = cottiAdminProcedure.use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      topicOverviewService: new CottiTopicOverviewService(ctx.serverDB),
    },
  });
});

export const cottiTopicOverviewRouter = router({
  detail: cottiTopicOverviewProcedure
    .input(z.object({ topicId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      try {
        const data = await ctx.topicOverviewService.getDetail(input.topicId);
        if (!data) throw new TRPCError({ code: 'NOT_FOUND', message: 'Topic not found' });

        await ctx.topicOverviewService.recordView({
          adminEmail: ctx.platformAdmin.normalizedEmail || ctx.platformAdmin.email,
          adminUserId: ctx.platformAdmin.userId,
          target: data,
        });

        return { data, success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('[cottiTopicOverview:detail]', error);
        throw new TRPCError({
          cause: error,
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to load topic detail',
        });
      }
    }),
  list: cottiTopicOverviewProcedure
    .input(cottiTopicOverviewQuerySchema.optional())
    .query(async ({ ctx, input }) => {
      try {
        const data = await ctx.topicOverviewService.list(input);
        return { data, success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('[cottiTopicOverview:list]', error);
        throw new TRPCError({
          cause: error,
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to load topic overview',
        });
      }
    }),
});
