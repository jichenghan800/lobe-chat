import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { PlatformAnalyticsService } from '@/server/services/platformAnalytics';
import type { PlatformAnalyticsQuery, PlatformAnalyticsRange } from '@/types/platformAnalytics';

import { assertPlatformAdminAccess } from './_helpers/platformAdmin';

const dashboardInput = z.object({
  customRange: z
    .object({
      end: z.string().datetime(),
      start: z.string().datetime(),
    })
    .optional(),
  range: z.union([z.literal(1), z.literal(7), z.literal(30), z.literal(90)]).default(1),
});

const platformAnalyticsProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;
  await assertPlatformAdminAccess(ctx.serverDB, ctx.userId);

  return opts.next({
    ctx: {
      platformAnalyticsService: new PlatformAnalyticsService(ctx.serverDB),
    },
  });
});

export const platformAnalyticsRouter = router({
  dashboard: platformAnalyticsProcedure.input(dashboardInput).query(async ({ ctx, input }) => {
    try {
      return await ctx.platformAnalyticsService.getDashboard(input as PlatformAnalyticsQuery);
    } catch (error) {
      if (error instanceof TRPCError) throw error;

      console.error('[platformAnalytics:dashboard]', error);
      throw new TRPCError({
        cause: error,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to load platform analytics dashboard.',
      });
    }
  }),

  feedback: platformAnalyticsProcedure.input(dashboardInput).query(async ({ ctx, input }) => {
    try {
      return await ctx.platformAnalyticsService.getFeedbackAnalytics(
        input.range as PlatformAnalyticsRange,
      );
    } catch (error) {
      if (error instanceof TRPCError) throw error;

      console.error('[platformAnalytics:feedback]', error);
      throw new TRPCError({
        cause: error,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to load platform feedback analytics.',
      });
    }
  }),
});
