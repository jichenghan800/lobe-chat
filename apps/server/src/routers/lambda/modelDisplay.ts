import { z } from 'zod';

import {
  CottiModelDisplayModel,
  getEnabledModelDisplayItems,
} from '@/database/models/cottiModelDisplay';
import { authedProcedure, publicProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { getServerGlobalConfig } from '@/server/globalConfig';
import type { ModelDisplayConfig, ModelDisplayOption } from '@/types/modelDisplay';

import { assertPlatformAdminAccess } from './_helpers/platformAdmin';

const itemSchema = z.object({
  displayName: z.string().max(100).optional(),
  enabled: z.boolean(),
  model: z.string().min(1).max(200),
  provider: z.string().min(1).max(100),
});

const configSchema = z.object({
  agent: z.array(itemSchema).max(50),
  chat: z.array(itemSchema).max(50),
});

const toOptionLabel = (provider: string, model: string, displayName?: string) => {
  if (displayName && displayName !== model) return `${displayName} (${provider}/${model})`;

  return `${provider}/${model}`;
};

export const modelDisplayRouter = router({
  detail: publicProcedure
    .use(serverDatabase)
    .query(async ({ ctx }): Promise<ModelDisplayConfig> => {
      return new CottiModelDisplayModel(ctx.serverDB).getConfig();
    }),

  options: authedProcedure
    .use(serverDatabase)
    .query(async ({ ctx }): Promise<ModelDisplayOption[]> => {
      await assertPlatformAdminAccess(ctx.serverDB, ctx.userId);

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
    }),

  update: authedProcedure
    .use(serverDatabase)
    .input(configSchema)
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdminAccess(ctx.serverDB, ctx.userId);

      const settings = await new CottiModelDisplayModel(ctx.serverDB).updateConfig(
        input,
        ctx.userId,
      );

      return {
        config: settings.config,
        visibleModels: getEnabledModelDisplayItems(settings.config),
      };
    }),
});
