import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { users } from '@/database/schemas';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { PlatformAnalyticsService } from '@/server/services/platformAnalytics';
import type { PlatformAnalyticsRange } from '@/types/platformAnalytics';

const dashboardInput = z.object({
  range: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30),
});

const parseAdminEmails = () =>
  (process.env.COTTI_PLATFORM_ANALYTICS_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

const platformAnalyticsProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;
  const user = await ctx.serverDB.query.users.findFirst({
    columns: { email: true, id: true, normalizedEmail: true, role: true },
    where: eq(users.id, ctx.userId),
  });

  const adminEmails = parseAdminEmails();
  const email = (user?.normalizedEmail || user?.email || '').toLowerCase();
  const isAllowedByEmail = adminEmails.includes('*') || (!!email && adminEmails.includes(email));
  const isAdminRole = user?.role === 'admin';

  if (!isAllowedByEmail && !isAdminRole) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Platform analytics access denied.' });
  }

  return opts.next({
    ctx: {
      platformAnalyticsService: new PlatformAnalyticsService(ctx.serverDB),
    },
  });
});

export const platformAnalyticsRouter = router({
  dashboard: platformAnalyticsProcedure.input(dashboardInput).query(async ({ ctx, input }) => {
    try {
      return await ctx.platformAnalyticsService.getDashboard(input.range as PlatformAnalyticsRange);
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
});
