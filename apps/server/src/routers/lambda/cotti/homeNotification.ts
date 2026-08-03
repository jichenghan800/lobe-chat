import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { CottiHomeNotificationModel } from '@/database/models/cottiHomeNotification';
import { publicProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';

import { cottiAdminProcedure } from './procedure';

const HOME_NOTIFICATION_CONTENT_MAX_LENGTH = 500;

const homeNotificationConfigSchema = z.object({
  content: z.string().max(HOME_NOTIFICATION_CONTENT_MAX_LENGTH),
  enabled: z.boolean(),
});

const cottiHomeNotificationProcedure = publicProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      homeNotificationModel: new CottiHomeNotificationModel(ctx.serverDB),
    },
  });
});

const cottiHomeNotificationAdminProcedure = cottiAdminProcedure.use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      homeNotificationModel: new CottiHomeNotificationModel(ctx.serverDB),
    },
  });
});

export const cottiHomeNotificationRouter = router({
  detail: cottiHomeNotificationProcedure.query(async ({ ctx }) => {
    try {
      const data = await ctx.homeNotificationModel.getConfig();

      return { data, success: true };
    } catch (error) {
      console.error('[cottiHomeNotification:detail]', error);
      throw new TRPCError({
        cause: error,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to load the COTTI home notification',
      });
    }
  }),

  update: cottiHomeNotificationAdminProcedure
    .input(homeNotificationConfigSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const settings = await ctx.homeNotificationModel.updateConfig(
          input,
          ctx.platformAdmin.userId,
        );

        return {
          data: { content: settings.content, enabled: settings.enabled },
          message: 'COTTI home notification updated',
          success: true,
        };
      } catch (error) {
        console.error('[cottiHomeNotification:update]', error);
        throw new TRPCError({
          cause: error,
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update the COTTI home notification',
        });
      }
    }),
});
