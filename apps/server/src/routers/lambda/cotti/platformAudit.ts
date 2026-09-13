import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { router } from '@/libs/trpc/lambda';
import {
  cottiPlatformAuditQuerySchema,
  CottiPlatformAuditService,
} from '@/server/services/cotti/platformAudit';

import { cottiAdminProcedure } from './procedure';

const cottiPlatformAuditProcedure = cottiAdminProcedure.use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      platformAuditService: new CottiPlatformAuditService(ctx.serverDB),
    },
  });
});

export const cottiPlatformAuditRouter = router({
  analyzeMessageRisk: cottiPlatformAuditProcedure
    .input(z.object({ force: z.boolean().optional(), messageId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const data = await ctx.platformAuditService.analyzeMessageRisk({
          adminEmail: ctx.platformAdmin.normalizedEmail || ctx.platformAdmin.email,
          adminUserId: ctx.platformAdmin.userId,
          force: input.force,
          messageId: input.messageId,
        });

        return { data, message: 'COTTI platform audit risk analysis completed', success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('[cottiPlatformAudit:analyzeMessageRisk]', error);
        throw new TRPCError({
          cause: error,
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to analyze COTTI platform audit risk',
        });
      }
    }),
  dashboard: cottiPlatformAuditProcedure
    .input(cottiPlatformAuditQuerySchema.optional())
    .query(async ({ ctx, input }) => {
      try {
        const data = await ctx.platformAuditService.getDashboard(input);

        return { data, success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('[cottiPlatformAudit:dashboard]', error);
        throw new TRPCError({
          cause: error,
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to load COTTI platform audit dashboard',
        });
      }
    }),
  messageDetail: cottiPlatformAuditProcedure
    .input(z.object({ messageId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      try {
        const data = await ctx.platformAuditService.getMessageDetail(input.messageId);
        if (!data) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Audit message not found' });
        }

        await ctx.platformAuditService.recordMessageView({
          adminEmail: ctx.platformAdmin.normalizedEmail || ctx.platformAdmin.email,
          adminUserId: ctx.platformAdmin.userId,
          metadata: { source: 'cotti-platform-management' },
          target: data,
        });

        return { data, success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('[cottiPlatformAudit:messageDetail]', error);
        throw new TRPCError({
          cause: error,
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to load COTTI platform audit message detail',
        });
      }
    }),
});
