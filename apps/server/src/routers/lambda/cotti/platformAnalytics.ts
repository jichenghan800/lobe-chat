import { TRPCError } from '@trpc/server';

import { router } from '@/libs/trpc/lambda';
import { CottiPlatformAnalyticsService } from '@/server/services/cotti/platformAnalytics';
import { cottiPlatformAnalyticsAgentsQuerySchema } from '@/server/services/cotti/platformAnalytics/agents';
import { cottiPlatformAnalyticsChatModelsQuerySchema } from '@/server/services/cotti/platformAnalytics/chatModels';
import { cottiPlatformAnalyticsChatUsersQuerySchema } from '@/server/services/cotti/platformAnalytics/chatUsers';
import {
  cottiPlatformAnalyticsAgentErrorsQuerySchema,
  cottiPlatformAnalyticsChatErrorsQuerySchema,
} from '@/server/services/cotti/platformAnalytics/errors';
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
  agentErrors: cottiPlatformAnalyticsProcedure
    .input(cottiPlatformAnalyticsAgentErrorsQuerySchema.optional())
    .query(async ({ ctx, input }) => {
      try {
        const data = await ctx.platformAnalyticsService.getAgentErrors(input);

        return { data, success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('[cottiPlatformAnalytics:agentErrors]', error);
        throw new TRPCError({
          cause: error,
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to load COTTI platform Agent error analytics',
        });
      }
    }),
  agents: cottiPlatformAnalyticsProcedure
    .input(cottiPlatformAnalyticsAgentsQuerySchema.optional())
    .query(async ({ ctx, input }) => {
      try {
        const data = await ctx.platformAnalyticsService.getAgents(input);

        return { data, success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('[cottiPlatformAnalytics:agents]', error);
        throw new TRPCError({
          cause: error,
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to load COTTI platform Agent analytics',
        });
      }
    }),
  chatErrors: cottiPlatformAnalyticsProcedure
    .input(cottiPlatformAnalyticsChatErrorsQuerySchema.optional())
    .query(async ({ ctx, input }) => {
      try {
        const data = await ctx.platformAnalyticsService.getChatErrors(input);

        return { data, success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('[cottiPlatformAnalytics:chatErrors]', error);
        throw new TRPCError({
          cause: error,
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to load COTTI platform Chat error analytics',
        });
      }
    }),
  chatModels: cottiPlatformAnalyticsProcedure
    .input(cottiPlatformAnalyticsChatModelsQuerySchema.optional())
    .query(async ({ ctx, input }) => {
      try {
        const data = await ctx.platformAnalyticsService.getChatModels(input);

        return { data, success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('[cottiPlatformAnalytics:chatModels]', error);
        throw new TRPCError({
          cause: error,
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to load COTTI platform Chat model analytics',
        });
      }
    }),
  chatUsers: cottiPlatformAnalyticsProcedure
    .input(cottiPlatformAnalyticsChatUsersQuerySchema.optional())
    .query(async ({ ctx, input }) => {
      try {
        const data = await ctx.platformAnalyticsService.getChatUsers(input);

        return { data, success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('[cottiPlatformAnalytics:chatUsers]', error);
        throw new TRPCError({
          cause: error,
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to load COTTI platform Chat user analytics',
        });
      }
    }),
  dashboard: cottiPlatformAnalyticsProcedure
    .input(cottiPlatformAnalyticsQuerySchema.optional())
    .query(async ({ ctx, input }) => {
      try {
        const data = await ctx.platformAnalyticsService.getDashboard(input);

        return { data, success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('[cottiPlatformAnalytics:dashboard]', error);
        throw new TRPCError({
          cause: error,
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to load COTTI platform analytics',
        });
      }
    }),
  features: cottiPlatformAnalyticsProcedure
    .input(cottiPlatformAnalyticsQuerySchema.optional())
    .query(async ({ ctx, input }) => {
      try {
        const data = await ctx.platformAnalyticsService.getFeatures(input);

        return { data, success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('[cottiPlatformAnalytics:features]', error);
        throw new TRPCError({
          cause: error,
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to load COTTI platform feature analytics',
        });
      }
    }),
});
