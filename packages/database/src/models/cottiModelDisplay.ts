import { and, count, eq, sql } from 'drizzle-orm';

import {
  COTTI_MODEL_DISPLAY_DEFAULTS,
  type CottiProfessionalModelId,
  getCottiProfessionalModel,
  getModelDisplayDefault,
  isSameModelDisplayRef,
  normalizeModelDisplayRef,
  switchCottiProfessionalModelInConfig,
} from '@/_custom/registry/modelDisplayConfig';
import { resolveRetiredModel } from '@/_custom/registry/modelRetirement';
import type {
  ModelDisplayConfig,
  ModelDisplayDefaults,
  ModelDisplayItem,
  ModelDisplayScope,
} from '@/types/modelDisplay';

import type { CottiModelDisplaySettingsItem, NewCottiModelDisplaySettings } from '../schemas';
import { agents, cottiModelDisplaySettings } from '../schemas';
import type { LobeChatDatabase } from '../type';

const SETTINGS_ID = 'default';

export const DEFAULT_COTTI_MODEL_DISPLAY_CONFIG: ModelDisplayConfig = {
  agent: [
    { displayName: 'COTTI-专业', enabled: true, model: 'gemini-3.6-flash', provider: 'vertexai' },
    {
      displayName: '豆包2.1-Pro',
      enabled: true,
      model: 'doubao-seed-2-1-pro-260628',
      provider: 'volcengine',
    },
    { displayName: '千问3.8-Max', enabled: true, model: 'qwen3.8-max-0902', provider: 'qwen' },
    { displayName: '千问3.7-Plus', enabled: true, model: 'qwen3.7-plus', provider: 'qwen' },
    { displayName: '全能效率', enabled: true, model: 'gpt-5.5', provider: 'azure' },
    { displayName: '智谱-GLM5.2', enabled: true, model: 'glm-5.2', provider: 'qwen' },
    { displayName: 'GPT-5.6 Sol', enabled: true, model: 'gpt-5.6-sol', provider: 'azure' },
    { displayName: 'GPT-5.6 Terra', enabled: true, model: 'gpt-5.6-terra', provider: 'azure' },
    { displayName: 'GPT-5.6 Luna', enabled: true, model: 'gpt-5.6-luna', provider: 'azure' },
  ],
  chat: [
    {
      displayName: 'COTTI-快速',
      enabled: true,
      model: 'gemini-3.5-flash-lite',
      provider: 'vertexai',
    },
    { displayName: 'COTTI-专业', enabled: true, model: 'gemini-3.6-flash', provider: 'vertexai' },
    { displayName: '千问3.8-Max', enabled: true, model: 'qwen3.8-max-0902', provider: 'qwen' },
    { displayName: '千问3.7-Plus', enabled: true, model: 'qwen3.7-plus', provider: 'qwen' },
    { displayName: 'GPT-5.6 Sol', enabled: true, model: 'gpt-5.6-sol', provider: 'azure' },
    { displayName: 'GPT-5.6 Terra', enabled: true, model: 'gpt-5.6-terra', provider: 'azure' },
    { displayName: 'GPT-5.6 Luna', enabled: true, model: 'gpt-5.6-luna', provider: 'azure' },
  ],
  defaults: COTTI_MODEL_DISPLAY_DEFAULTS,
};

const normalizeText = (value: string) => value.trim();

const normalizeItem = (item: ModelDisplayItem): ModelDisplayItem | undefined => {
  const provider = normalizeText(item.provider);
  const model = normalizeText(item.model);
  if (!provider || !model) return;

  const displayName = item.displayName?.trim();

  return {
    ...(displayName ? { displayName } : {}),
    enabled: item.enabled,
    model,
    provider,
  };
};

export const normalizeModelDisplayConfig = (config: ModelDisplayConfig): ModelDisplayConfig => {
  const normalizedConfig: ModelDisplayConfig = {
    ...(config.retirements ? { retirements: config.retirements } : {}),
    agent: config.agent.map(normalizeItem).filter(Boolean) as ModelDisplayItem[],
    chat: config.chat.map(normalizeItem).filter(Boolean) as ModelDisplayItem[],
    defaults: {
      agent: normalizeModelDisplayRef(config.defaults?.agent),
      chat: normalizeModelDisplayRef(config.defaults?.chat),
    },
  };
  const defaults: ModelDisplayDefaults = {};

  for (const scope of ['agent', 'chat'] as const satisfies ModelDisplayScope[]) {
    const defaultModel = getModelDisplayDefault(normalizedConfig, scope);
    if (defaultModel) defaults[scope] = defaultModel;
  }

  return { ...normalizedConfig, defaults };
};

export const getEnabledModelDisplayItems = (config: ModelDisplayConfig): ModelDisplayItem[] => {
  const seen = new Set<string>();
  const result: ModelDisplayItem[] = [];

  for (const item of [...config.chat, ...config.agent]) {
    if (!item.enabled) continue;
    if (config.retirements?.some((r) => isSameModelDisplayRef(r.source, item))) continue;
    const key = `${item.provider.trim().toLowerCase()}/${item.model.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
};

export class CottiModelDisplayModel {
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase) {
    this.db = db;
  }

  getConfig = async (): Promise<ModelDisplayConfig> => {
    const settings = await this.getSettings();

    return normalizeModelDisplayConfig(settings?.config || DEFAULT_COTTI_MODEL_DISPLAY_CONFIG);
  };

  getSettings = async (): Promise<CottiModelDisplaySettingsItem | undefined> => {
    const [settings] = await this.db
      .select()
      .from(cottiModelDisplaySettings)
      .where(eq(cottiModelDisplaySettings.id, SETTINGS_ID))
      .limit(1);

    return settings;
  };

  getProfessionalModelStatus = async () => {
    const config = await this.getConfig();
    const currentModel = getCottiProfessionalModel(config);
    const [agentCount] = await this.db
      .select({ value: count() })
      .from(agents)
      .where(and(eq(agents.provider, currentModel.provider), eq(agents.model, currentModel.model)));

    return {
      affectedAgentCount: agentCount.value,
      currentModel,
    };
  };

  switchProfessionalModel = async (
    targetModel: CottiProfessionalModelId,
    updatedBy?: string | null,
  ) => {
    return this.db.transaction(async (tx) => {
      const [settings] = await tx
        .select()
        .from(cottiModelDisplaySettings)
        .where(eq(cottiModelDisplaySettings.id, SETTINGS_ID))
        .limit(1)
        .for('update');
      const currentConfig = normalizeModelDisplayConfig(
        settings?.config || DEFAULT_COTTI_MODEL_DISPLAY_CONFIG,
      );
      const previousModel = getCottiProfessionalModel(currentConfig);
      const nextConfig = normalizeModelDisplayConfig(
        switchCottiProfessionalModelInConfig(currentConfig, targetModel),
      );
      const now = new Date();

      const [nextSettings] = await tx
        .insert(cottiModelDisplaySettings)
        .values({
          config: nextConfig,
          id: SETTINGS_ID,
          updatedBy: updatedBy ?? null,
        })
        .onConflictDoUpdate({
          set: { config: nextConfig, updatedAt: now, updatedBy: updatedBy ?? null },
          target: cottiModelDisplaySettings.id,
        })
        .returning();

      const usesThinkingLevel3 =
        targetModel === 'gemini-3.7-flash' || targetModel === 'gemini-3.8-flash';
      const chatConfig = usesThinkingLevel3
        ? sql`CASE
              WHEN ${agents.chatConfig} IS NULL THEN NULL
              WHEN ${agents.chatConfig} ? 'thinkingLevel3'
                THEN ${agents.chatConfig} - 'thinkingLevel'
              WHEN ${agents.chatConfig} ? 'thinkingLevel'
                THEN (${agents.chatConfig} - 'thinkingLevel') || jsonb_build_object(
                  'thinkingLevel3',
                  CASE ${agents.chatConfig}->>'thinkingLevel'
                    WHEN 'minimal' THEN 'low'
                    WHEN 'low' THEN 'low'
                    WHEN 'medium' THEN 'medium'
                    WHEN 'high' THEN 'high'
                    ELSE 'medium'
                  END
                )
              ELSE ${agents.chatConfig}
            END`
        : sql`CASE
              WHEN ${agents.chatConfig} IS NULL THEN NULL
              WHEN ${agents.chatConfig} ? 'thinkingLevel'
                THEN ${agents.chatConfig} - 'thinkingLevel3'
              WHEN ${agents.chatConfig} ? 'thinkingLevel3'
                THEN (${agents.chatConfig} - 'thinkingLevel3') || jsonb_build_object(
                  'thinkingLevel', ${agents.chatConfig}->>'thinkingLevel3'
                )
              ELSE ${agents.chatConfig}
            END`;
      const updatedAgents = await tx
        .update(agents)
        .set({ chatConfig, model: targetModel, updatedAt: now })
        .where(
          and(eq(agents.provider, previousModel.provider), eq(agents.model, previousModel.model)),
        )
        .returning({ id: agents.id });

      return {
        affectedAgentCount: updatedAgents.length,
        config: nextSettings.config,
        previousModel,
        targetModel: { model: targetModel, provider: 'vertexai' },
      };
    });
  };

  updateConfig = async (
    config: ModelDisplayConfig,
    updatedBy?: string | null,
  ): Promise<CottiModelDisplaySettingsItem> => {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`LOCK TABLE cotti_model_display_settings IN SHARE ROW EXCLUSIVE MODE`);
      const current = await new CottiModelDisplayModel(tx as LobeChatDatabase).getSettings();
      const retirements = current?.config.retirements || config.retirements;
      const next = structuredClone({ ...config, retirements });
      for (const retired of retirements || []) {
        for (const scope of ['chat', 'agent'] as const) {
          next[scope] = next[scope].map((r) =>
            isSameModelDisplayRef(r, retired.source) ? { ...r, enabled: false } : r,
          );
          if (
            next.defaults?.[scope] &&
            isSameModelDisplayRef(next.defaults[scope]!, retired.source)
          )
            next.defaults[scope] = resolveRetiredModel(next, retired.source);
        }
      }
      const normalizedConfig = normalizeModelDisplayConfig(next);
      const insertValue: NewCottiModelDisplaySettings = {
        config: normalizedConfig,
        id: SETTINGS_ID,
        updatedBy: updatedBy ?? null,
      };

      const [settings] = await tx
        .insert(cottiModelDisplaySettings)
        .values(insertValue)
        .onConflictDoUpdate({
          set: {
            config: normalizedConfig,
            updatedAt: new Date(),
            updatedBy: updatedBy ?? null,
          },
          target: cottiModelDisplaySettings.id,
        })
        .returning();

      return settings;
    });
  };
}
