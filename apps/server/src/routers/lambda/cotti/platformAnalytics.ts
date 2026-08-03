import { TRPCError } from '@trpc/server';

import { router } from '@/libs/trpc/lambda';
import { CottiPlatformAnalyticsService } from '@/server/services/cotti/platformAnalytics';
import { cottiPlatformAnalyticsQuerySchema } from '@/server/services/cotti/platformAnalytics/range';

import { cottiAdminProcedure } from './procedure';

const cottiPlatformAnalyticsProcedure = cottiAdminProcedure.use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      platformAnalyticsService: new CottiPlatformAnalyticsService(ctx.serverDB),
    },
  });
});

export const cottiPlatformAnalyticsRouter = router({
  dashboard: cottiPlatformAnalyticsProcedure
    .input(cottiPlatformAnalyticsQuerySchema.optional())
    .query(async ({ ctx, input }) => {
      try {
        const data = await ctx.platformAnalyticsService.getDashboard(input);

        return { data, success: true };
      } catch (error) {
        console.error('[cottiPlatformAnalytics:dashboard]', error);
        throw new TRPCError({
          cause: error,
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to load COTTI platform analytics',
        });
      }
    }),
});
