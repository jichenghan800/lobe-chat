import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { getCottiAgentAccessMode } from '@/_custom/registry/agentAccess';
import {
  CottiAgentAccessModel,
  normalizeCottiAgentAccessValue,
} from '@/database/models/cottiAgentAccess';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import type { AgentAccessDetail } from '@/types/agentAccess';

import { assertPlatformAdminAccess } from './_helpers/platformAdmin';

const modeSchema = z.enum(['allowlist', 'open', 'off']);
const ruleTypeSchema = z.enum(['email', 'userId']);

const agentAccessProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;
  await assertPlatformAdminAccess(ctx.serverDB, ctx.userId);

  return opts.next({
    ctx: {
      agentAccessModel: new CottiAgentAccessModel(ctx.serverDB),
    },
  });
});

export const agentAccessRouter = router({
  detail: agentAccessProcedure.query(async ({ ctx }): Promise<AgentAccessDetail> => {
    const [settings, rules] = await Promise.all([
      ctx.agentAccessModel.getSettings(),
      ctx.agentAccessModel.listRules(),
    ]);

    return {
      mode: settings?.mode ?? getCottiAgentAccessMode(),
      rules,
      source: settings ? 'database' : 'environment',
    };
  }),

  removeRule: agentAccessProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.agentAccessModel.removeRule(input.id);

      return { success: true };
    }),

  setMode: agentAccessProcedure
    .input(z.object({ mode: modeSchema }))
    .mutation(async ({ ctx, input }) => {
      return ctx.agentAccessModel.setMode(input.mode, ctx.userId);
    }),

  setRuleEnabled: agentAccessProcedure
    .input(z.object({ enabled: z.boolean(), id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const rule = await ctx.agentAccessModel.setRuleEnabled(input.id, input.enabled);

      if (!rule) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent access rule not found.' });
      }

      return rule;
    }),

  upsertRule: agentAccessProcedure
    .input(
      z.object({
        note: z.string().max(200).optional(),
        type: ruleTypeSchema,
        value: z.string().min(1).max(256),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const value = normalizeCottiAgentAccessValue(input.type, input.value);
      if (!value) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Agent access rule value is empty.' });
      }

      return ctx.agentAccessModel.upsertRule({
        createdBy: ctx.userId,
        note: input.note,
        type: input.type,
        value,
      });
    }),
});
