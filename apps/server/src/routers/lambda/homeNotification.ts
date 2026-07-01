import { z } from 'zod';

import { CottiHomeNotificationModel } from '@/database/models/cottiHomeNotification';
import { authedProcedure, publicProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import type { HomeNotificationConfig } from '@/types/homeNotification';

import { assertPlatformAdminAccess } from './_helpers/platformAdmin';

const contentMaxLength = 500;

const homeNotificationConfigSchema = z.object({
  content: z.string().max(contentMaxLength),
  enabled: z.boolean(),
});

export const homeNotificationRouter = router({
  detail: publicProcedure
    .use(serverDatabase)
    .query(async ({ ctx }): Promise<HomeNotificationConfig> => {
      return new CottiHomeNotificationModel(ctx.serverDB).getConfig();
    }),

  update: authedProcedure
    .use(serverDatabase)
    .input(homeNotificationConfigSchema)
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdminAccess(ctx.serverDB, ctx.userId);

      return new CottiHomeNotificationModel(ctx.serverDB).updateConfig(input, ctx.userId);
    }),
});
