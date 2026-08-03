import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { CottiAgentModeVisibilityService } from '@/server/services/cotti/agentModeVisibility';

import { cottiAdminProcedure } from './procedure';

const modeSchema = z.enum(['allowlist', 'off', 'open']);
const ruleTypeSchema = z.enum(['email', 'userId']);

const cottiAgentAccessProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      agentModeVisibilityService: new CottiAgentModeVisibilityService(ctx.serverDB, ctx.userId),
    },
  });
});

const cottiAgentAccessAdminProcedure = cottiAdminProcedure.use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      agentModeVisibilityService: new CottiAgentModeVisibilityService(ctx.serverDB, ctx.userId),
    },
  });
});

export const cottiAgentAccessRouter = router({
  detail: cottiAgentAccessAdminProcedure.query(async ({ ctx }) => {
    try {
      const data = await ctx.agentModeVisibilityService.getDetail();

      return { data, success: true };
    } catch (error) {
      console.error('[cottiAgentAccess:detail]', error);
      throw new TRPCError({
        cause: error,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to load the Agent mode entry visibility configuration',
      });
    }
  }),

  removeRule: cottiAgentAccessAdminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.agentModeVisibilityService.removeRule(input.id);

        return {
          message: 'Agent mode visibility rule removed',
          success: true,
        };
      } catch (error) {
        console.error('[cottiAgentAccess:removeRule]', error);
        throw new TRPCError({
          cause: error,
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to remove the Agent mode visibility rule',
        });
      }
    }),

  searchUsers: cottiAgentAccessAdminProcedure
    .input(z.object({ query: z.string().min(2).max(128) }))
    .query(async ({ ctx, input }) => {
      try {
        const data = await ctx.agentModeVisibilityService.searchUsers(input.query);

        return { data, success: true };
      } catch (error) {
        console.error('[cottiAgentAccess:searchUsers]', error);
        throw new TRPCError({
          cause: error,
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to search users for Agent mode entry visibility',
        });
      }
    }),

  setMode: cottiAgentAccessAdminProcedure
    .input(z.object({ mode: modeSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        const settings = await ctx.agentModeVisibilityService.setMode(input.mode);

        return {
          data: { mode: settings.mode },
          message: 'Agent mode entry visibility updated',
          success: true,
        };
      } catch (error) {
        console.error('[cottiAgentAccess:setMode]', error);
        throw new TRPCError({
          cause: error,
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update the Agent mode entry visibility',
        });
      }
    }),

  setRuleEnabled: cottiAgentAccessAdminProcedure
    .input(z.object({ enabled: z.boolean(), id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const rule = await ctx.agentModeVisibilityService.setRuleEnabled(input.id, input.enabled);
        if (!rule) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Agent mode visibility rule not found',
          });
        }

        return {
          data: rule,
          message: 'Agent mode visibility rule updated',
          success: true,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error('[cottiAgentAccess:setRuleEnabled]', error);
        throw new TRPCError({
          cause: error,
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update the Agent mode visibility rule',
        });
      }
    }),

  status: cottiAgentAccessProcedure.query(async ({ ctx }) => {
    try {
      const visible = await ctx.agentModeVisibilityService.getVisibility();

      return { data: { visible }, success: true };
    } catch (error) {
      console.error('[cottiAgentAccess:status]', error);
      throw new TRPCError({
        cause: error,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to load the Agent mode entry visibility',
      });
    }
  }),

  upsertRule: cottiAgentAccessAdminProcedure
    .input(
      z.object({
        note: z.string().max(200).optional(),
        type: ruleTypeSchema,
        value: z.string().min(1).max(256),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const rule = await ctx.agentModeVisibilityService.upsertRule(input);

        return {
          data: rule,
          message: 'Agent mode visibility rule saved',
          success: true,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error('[cottiAgentAccess:upsertRule]', error);
        throw new TRPCError({
          cause: error,
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to save the Agent mode visibility rule',
        });
      }
    }),
});
