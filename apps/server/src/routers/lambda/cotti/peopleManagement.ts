import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { router } from '@/libs/trpc/lambda';
import { CottiPeopleManagementService } from '@/server/services/cotti/peopleManagement';

import { cottiAdminProcedure } from './procedure';

const cottiPeopleManagementProcedure = cottiAdminProcedure.use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      peopleManagementService: new CottiPeopleManagementService(ctx.serverDB, ctx.userId),
    },
  });
});

const loginEmailSchema = z.string().trim().email().max(320);
const loginDomainSchema = z
  .string()
  .trim()
  .min(3)
  .max(253)
  .regex(/^(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z\d][a-z\d-]{0,62}$/i);

const loginRuleSchema = z.discriminatedUnion('type', [
  z.object({
    note: z.string().trim().max(200).optional(),
    type: z.literal('email'),
    value: loginEmailSchema,
  }),
  z.object({
    note: z.string().trim().max(200).optional(),
    type: z.literal('domain'),
    value: loginDomainSchema,
  }),
]);

const cottiAiPhoneSchema = z
  .string()
  .trim()
  .max(30)
  .refine((value) => {
    const digits = value.replaceAll(/\D/g, '');
    return /^1[3-9]\d{9}$/.test(digits) || /^861[3-9]\d{9}$/.test(digits);
  }, 'Invalid Chinese mobile phone number');
const cottiAiMemberSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100),
    email: loginEmailSchema.optional(),
    note: z.string().trim().max(200).optional(),
    phone: cottiAiPhoneSchema.optional(),
  })
  .refine((input) => input.email || input.phone, {
    message: 'Email or phone is required',
    path: ['email'],
  });

const environmentLoginRuleIdSchema = z
  .string()
  .max(350)
  .refine((id) => {
    const match = /^environment:(email|domain):(.+)$/.exec(id);
    if (!match) return false;

    return (match[1] === 'email' ? loginEmailSchema : loginDomainSchema).safeParse(match[2])
      .success;
  }, 'Invalid environment login access rule ID');
const loginRuleIdSchema = z.union([z.string().uuid(), environmentLoginRuleIdSchema]);

const wrapMutationError = (scope: string, message: string, error: unknown): never => {
  if (error instanceof TRPCError) throw error;
  console.error(`[cottiPeopleManagement:${scope}]`, error);
  throw new TRPCError({ cause: error, code: 'INTERNAL_SERVER_ERROR', message });
};

export const cottiPeopleManagementRouter = router({
  addAdministrator: cottiPeopleManagementProcedure
    .input(z.object({ note: z.string().trim().max(200).optional(), userId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const data = await ctx.peopleManagementService.addAdministrator(input.userId, input.note);
        return { data, message: 'Platform administrator added', success: true };
      } catch (error) {
        wrapMutationError('addAdministrator', 'Failed to add platform administrator', error);
      }
    }),
  detail: cottiPeopleManagementProcedure.query(async ({ ctx }) => {
    try {
      const data = await ctx.peopleManagementService.getDetail();
      return { data, success: true };
    } catch (error) {
      wrapMutationError('detail', 'Failed to load people management', error);
    }
  }),
  removeAdministrator: cottiPeopleManagementProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.peopleManagementService.removeAdministrator(input.id);
        return { message: 'Platform administrator removed', success: true };
      } catch (error) {
        wrapMutationError('removeAdministrator', 'Failed to remove platform administrator', error);
      }
    }),
  removeCottiAiAccessMember: cottiPeopleManagementProcedure
    .input(z.object({ id: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.peopleManagementService.removeCottiAiAccessMember(input.id);
        return { message: 'COTTI AI access member removed', success: true };
      } catch (error) {
        wrapMutationError('removeCottiAiAccessMember', 'Failed to remove COTTI AI member', error);
      }
    }),
  removeLoginRule: cottiPeopleManagementProcedure
    .input(z.object({ id: loginRuleIdSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.peopleManagementService.removeLoginRule(input.id);
        return { message: 'Login access rule removed', success: true };
      } catch (error) {
        wrapMutationError('removeLoginRule', 'Failed to remove login access rule', error);
      }
    }),
  setLoginMode: cottiPeopleManagementProcedure
    .input(z.object({ mode: z.enum(['allowlist', 'open']) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const data = await ctx.peopleManagementService.setLoginMode(input.mode);
        return { data, message: 'Login access mode updated', success: true };
      } catch (error) {
        wrapMutationError('setLoginMode', 'Failed to update login access mode', error);
      }
    }),
  setCottiAiAccessMemberEnabled: cottiPeopleManagementProcedure
    .input(z.object({ enabled: z.boolean(), id: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const data = await ctx.peopleManagementService.setCottiAiAccessMemberEnabled(
          input.id,
          input.enabled,
        );
        return { data, message: 'COTTI AI member updated', success: true };
      } catch (error) {
        wrapMutationError(
          'setCottiAiAccessMemberEnabled',
          'Failed to update COTTI AI member',
          error,
        );
      }
    }),
  setLoginRuleEnabled: cottiPeopleManagementProcedure
    .input(z.object({ enabled: z.boolean(), id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const data = await ctx.peopleManagementService.setLoginRuleEnabled(input.id, input.enabled);
        return { data, message: 'Login access rule updated', success: true };
      } catch (error) {
        wrapMutationError('setLoginRuleEnabled', 'Failed to update login access rule', error);
      }
    }),
  setUserLoginDisabled: cottiPeopleManagementProcedure
    .input(
      z.object({
        disabled: z.boolean(),
        reason: z.string().trim().max(200).optional(),
        userId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const data = await ctx.peopleManagementService.setUserLoginDisabled(
          input.userId,
          input.disabled,
          input.reason,
        );
        return {
          data,
          message: input.disabled ? 'User login disabled' : 'User login restored',
          success: true,
        };
      } catch (error) {
        wrapMutationError('setUserLoginDisabled', 'Failed to update user login status', error);
      }
    }),
  upsertLoginRule: cottiPeopleManagementProcedure
    .input(loginRuleSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const data = await ctx.peopleManagementService.upsertLoginRule(input);
        return { data, message: 'Login access rule saved', success: true };
      } catch (error) {
        wrapMutationError('upsertLoginRule', 'Failed to save login access rule', error);
      }
    }),
  upsertCottiAiAccessMember: cottiPeopleManagementProcedure
    .input(cottiAiMemberSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const data = await ctx.peopleManagementService.upsertCottiAiAccessMember(input);
        return { data, message: 'COTTI AI access member saved', success: true };
      } catch (error) {
        wrapMutationError('upsertCottiAiAccessMember', 'Failed to save COTTI AI member', error);
      }
    }),
  updateCottiAiAccessMember: cottiPeopleManagementProcedure
    .input(cottiAiMemberSchema.extend({ id: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, ...member } = input;
        const data = await ctx.peopleManagementService.updateCottiAiAccessMember(id, member);
        return { data, message: 'COTTI AI access member updated', success: true };
      } catch (error) {
        wrapMutationError('updateCottiAiAccessMember', 'Failed to update COTTI AI member', error);
      }
    }),
});
