import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { PlatformAuditService } from '@/server/services/platformAudit';
import type { PlatformAuditQuery } from '@/types/platformAudit';

import { resolvePlatformAdminUser } from './_helpers/platformAdmin';

const auditInput = z.object({
  email: z.string().max(128).optional(),
  feature: z.enum(['all', 'agent', 'chat', 'error', 'search', 'tool']).default('all'),
  range: z.union([z.literal(1), z.literal(7), z.literal(30), z.literal(90)]).default(1),
  riskLevel: z.enum(['all', 'none', 'low', 'medium', 'high']).default('all'),
});

const platformAuditProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;
  const adminUser = await resolvePlatformAdminUser(ctx.serverDB, ctx.userId);

  return opts.next({
    ctx: {
      adminUser,
      platformAuditService: new PlatformAuditService(ctx.serverDB),
    },
  });
});

export const platformAuditRouter = router({
  dashboard: platformAuditProcedure.input(auditInput).query(async ({ ctx, input }) => {
    try {
      return await ctx.platformAuditService.getDashboard(input as PlatformAuditQuery);
    } catch (error) {
      if (error instanceof TRPCError) throw error;

      console.error('[platformAudit:dashboard]', error);
      throw new TRPCError({
        cause: error,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to load platform audit dashboard.',
      });
    }
  }),

  messageDetail: platformAuditProcedure
    .input(z.object({ messageId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      try {
        const detail = await ctx.platformAuditService.getMessageDetail(input.messageId);
        if (!detail) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Audit message not found.' });
        }

        await ctx.platformAuditService.recordMessageView({
          adminEmail: ctx.adminUser.normalizedEmail || ctx.adminUser.email,
          adminUserId: ctx.userId,
          metadata: { source: 'platform-audit' },
          target: detail,
        });

        return detail;
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error('[platformAudit:messageDetail]', error);
        throw new TRPCError({
          cause: error,
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to load audit message detail.',
        });
      }
    }),
});
