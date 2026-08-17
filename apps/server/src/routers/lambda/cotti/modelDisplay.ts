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
import { publicProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { getServerGlobalConfig } from '@/server/globalConfig';
import type { ModelDisplayOption, ModelDisplayScope } from '@/types/modelDisplay';

import { cottiAdminProcedure } from './procedure';

const MODEL_DISPLAY_NAME_MAX_LENGTH = 100;
const MODEL_ID_MAX_LENGTH = 200;
const MODEL_ITEMS_MAX_LENGTH = 50;
const PROVIDER_ID_MAX_LENGTH = 100;

const modelDisplayItemSchema = z.object({
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

const toOptionLabel = (provider: string, model: string, displayName?: string) => {
  if (displayName && displayName !== model) return `${displayName} (${provider}/${model})`;

  return `${provider}/${model}`;
};

const getDeployedModelOptions = async () => {
  const { aiProvider } = await getServerGlobalConfig();
  const options: ModelDisplayOption[] = [];

  for (const [provider, config] of Object.entries(aiProvider)) {
    if (!config?.enabled) continue;

    for (const model of config.serverModelLists || []) {
      if (model.type && model.type !== 'chat') continue;

      options.push({
        displayName: model.displayName,
        label: toOptionLabel(provider, model.id, model.displayName),
        model: model.id,
        provider,
      });
    }
  }

  const seen = new Set<string>();

  return options
    .filter((item) => {
      const key = `${item.provider.toLowerCase()}/${item.model.toLowerCase()}`;
      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    })
    .sort((a, b) => a.label.localeCompare(b.label));
};

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
        const settings = await ctx.modelDisplayModel.updateConfig(input, ctx.platformAdmin.userId);

        return {
          data: {
            config: settings.config,
            visibleModels: getEnabledModelDisplayItems(settings.config),
          },
          message: 'COTTI model display configuration updated',
          success: true,
        };
      } catch (error) {
        console.error('[cottiModelDisplay:update]', error);
        throw new TRPCError({
          cause: error,
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update the COTTI model display configuration',
        });
      }
    }),
});
