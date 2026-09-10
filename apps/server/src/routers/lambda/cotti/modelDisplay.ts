import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
  COTTI_PROFESSIONAL_MODEL_IDS,
  getModelDisplayDefault,
  isCottiProfessionalModel,
} from '@/_custom/registry/modelDisplayConfig';
import {
  CottiModelDisplayModel,
  getEnabledModelDisplayItems,
} from '@/database/models/cottiModelDisplay';
import {
  CottiTaskModelMigrationError,
  CottiTaskModelMigrationModel,
} from '@/database/models/cottiTaskModelMigration';
import { publicProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { getDeployedModelOptions } from '@/server/services/cotti/deployedModels';
import type { ModelDisplayScope } from '@/types/modelDisplay';

import { cottiAdminProcedure } from './procedure';

const MODEL_DISPLAY_NAME_MAX_LENGTH = 100;
const MODEL_ID_MAX_LENGTH = 200;
const MODEL_ITEMS_MAX_LENGTH = 50;
const PROVIDER_ID_MAX_LENGTH = 100;

const modelDisplayItemSchema = z.object({
  vip: z.boolean().optional(),
  displayName: z.string().max(MODEL_DISPLAY_NAME_MAX_LENGTH).optional(),
  enabled: z.boolean(),
  model: z.string().min(1).max(MODEL_ID_MAX_LENGTH),
  provider: z.string().min(1).max(PROVIDER_ID_MAX_LENGTH),
});

const modelDisplayModelRefSchema = z.object({
  model: z.string().trim().min(1).max(MODEL_ID_MAX_LENGTH),
  provider: z.string().trim().min(1).max(PROVIDER_ID_MAX_LENGTH),
});

const modelDisplayConfigSchema = z
  .object({
    agent: z.array(modelDisplayItemSchema).max(MODEL_ITEMS_MAX_LENGTH),
    chat: z.array(modelDisplayItemSchema).max(MODEL_ITEMS_MAX_LENGTH),
    defaults: z
      .object({
        agent: modelDisplayModelRefSchema.optional(),
        chat: modelDisplayModelRefSchema.optional(),
      })
      .optional(),
  })
  .superRefine((config, ctx) => {
    for (const scope of ['agent', 'chat'] as const satisfies ModelDisplayScope[]) {
      if (getModelDisplayDefault(config, scope)) continue;

      ctx.addIssue({
        code: 'custom',
        message: `The ${scope} default model must be enabled in the ${scope} model list`,
        path: ['defaults', scope],
      });
    }
  });

const cottiModelDisplayProcedure = publicProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      modelDisplayModel: new CottiModelDisplayModel(ctx.serverDB),
    },
  });
});

const cottiModelDisplayAdminProcedure = cottiAdminProcedure.use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      modelDisplayModel: new CottiModelDisplayModel(ctx.serverDB),
    },
  });
});

export const cottiModelDisplayRouter = router({
  taskMigrationPreview: cottiModelDisplayAdminProcedure
    .input(modelDisplayModelRefSchema)
    .query(async ({ ctx, input }) => ({
      data: await new CottiTaskModelMigrationModel(ctx.serverDB).preview(input),
      success: true,
    })),

  retireAndMigrateTasks: cottiModelDisplayAdminProcedure
    .input(
      z.object({
        source: modelDisplayModelRefSchema,
        target: modelDisplayModelRefSchema,
        revision: z.string().length(64),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const deployed = await getDeployedModelOptions();
      if (
        !deployed.some(
          (r) => r.model === input.target.model && r.provider === input.target.provider,
        )
      ) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '替代模型未部署，请重新选择' });
      }
      try {
        const data = await new CottiTaskModelMigrationModel(ctx.serverDB).migrate(
          input.source,
          input.target,
          input.revision,
          ctx.platformAdmin.userId,
        );
        return { data, success: true };
      } catch (error) {
        if (error instanceof CottiTaskModelMigrationError)
          throw new TRPCError({ code: 'CONFLICT', message: error.message });
        throw error;
      }
    }),

  detail: cottiModelDisplayProcedure.query(async ({ ctx }) => {
    try {
      const data = await ctx.modelDisplayModel.getConfig();

      return { data, success: true };
    } catch (error) {
      console.error('[cottiModelDisplay:detail]', error);
      throw new TRPCError({
        cause: error,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to load the COTTI model display configuration',
      });
    }
  }),

  options: cottiModelDisplayAdminProcedure.query(async () => {
    try {
      const data = await getDeployedModelOptions();

      return { data, success: true };
    } catch (error) {
      console.error('[cottiModelDisplay:options]', error);
      throw new TRPCError({
        cause: error,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to load the COTTI model display options',
      });
    }
  }),

  professionalModel: cottiModelDisplayAdminProcedure.query(async ({ ctx }) => {
    try {
      const [status, options] = await Promise.all([
        ctx.modelDisplayModel.getProfessionalModelStatus(),
        getDeployedModelOptions(),
      ]);

      return {
        data: { ...status, options: options.filter(isCottiProfessionalModel) },
        success: true,
      };
    } catch (error) {
      console.error('[cottiModelDisplay:professionalModel]', error);
      throw new TRPCError({
        cause: error,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to load the COTTI professional model configuration',
      });
    }
  }),

  switchProfessionalModel: cottiModelDisplayAdminProcedure
    .input(z.object({ model: z.enum(COTTI_PROFESSIONAL_MODEL_IDS) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const deployedModels = await getDeployedModelOptions();
        const targetIsDeployed = deployedModels.some(
          ({ model, provider }) => provider === 'vertexai' && model === input.model,
        );
        if (!targetIsDeployed) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `The target model vertexai/${input.model} is not deployed`,
          });
        }

        const current = await ctx.modelDisplayModel.getProfessionalModelStatus();
        if (current.currentModel.model !== input.model) {
          const impact = await new CottiTaskModelMigrationModel(ctx.serverDB).preview(
            current.currentModel,
          );
          if (impact.taskCount > 0)
            throw new TRPCError({
              code: 'CONFLICT',
              message: '专业模型仍被未结束任务引用，请先使用下方任务迁移操作',
            });
        }
        const data = await ctx.modelDisplayModel.switchProfessionalModel(
          input.model,
          ctx.platformAdmin.userId,
        );

        return { data, message: 'COTTI professional model switched', success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error('[cottiModelDisplay:switchProfessionalModel]', error);
        throw new TRPCError({
          cause: error,
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to switch the COTTI professional model',
        });
      }
    }),

  update: cottiModelDisplayAdminProcedure
    .input(modelDisplayConfigSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const previous = await ctx.modelDisplayModel.getConfig();
        // A scope switch-off is a global retirement, even if another list still enables it.
        for (const scope of ['agent', 'chat'] as const) {
          for (const source of previous[scope].filter((r) => r.enabled)) {
            if (
              !input[scope].some(
                (r) => r.enabled && r.provider === source.provider && r.model === source.model,
              )
            )
              throw new TRPCError({
                code: 'CONFLICT',
                message: '下线在全平台生效，请使用“全局下线并迁移引用”选择替代模型',
              });
          }
        }
        for (const retired of previous.retirements || []) {
          if (
            [...input.agent, ...input.chat].some(
              (r) =>
                r.enabled &&
                r.provider === retired.source.provider &&
                r.model === retired.source.model,
            )
          )
            throw new TRPCError({
              code: 'CONFLICT',
              message: '该模型已全局下线，不能通过列表开关重新启用',
            });
        }
        const settings = await ctx.modelDisplayModel.updateConfig(
          { ...input, retirements: previous.retirements },
          ctx.platformAdmin.userId,
        );

        return {
          data: {
            config: settings.config,
            visibleModels: getEnabledModelDisplayItems(settings.config),
          },
          message: 'COTTI model display configuration updated',
          success: true,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('[cottiModelDisplay:update]', error);
        throw new TRPCError({
          cause: error,
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update the COTTI model display configuration',
        });
      }
    }),
});
