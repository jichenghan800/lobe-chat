import { and, count, eq, inArray, sql } from 'drizzle-orm';

import {
  COTTI_MODEL_DISPLAY_DEFAULTS,
  COTTI_PROFESSIONAL_MODEL_IDS,
  type CottiProfessionalModelId,
  getCottiProfessionalModel,
  getModelDisplayDefault,
  normalizeModelDisplayRef,
  switchCottiProfessionalModelInConfig,
} from '@/_custom/registry/modelDisplayConfig';
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
    const [config, [agentCount]] = await Promise.all([
      this.getConfig(),
      this.db
        .select({ value: count() })
        .from(agents)
        .where(
          and(
            eq(agents.provider, 'vertexai'),
            inArray(agents.model, [...COTTI_PROFESSIONAL_MODEL_IDS]),
          ),
        ),
    ]);

    return {
      affectedAgentCount: agentCount.value,
      currentModel: getCottiProfessionalModel(config),
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

      const chatConfig =
        targetModel === 'gemini-3.7-flash'
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
          and(
            eq(agents.provider, 'vertexai'),
            inArray(agents.model, [...COTTI_PROFESSIONAL_MODEL_IDS]),
          ),
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
    const normalizedConfig = normalizeModelDisplayConfig(config);
    const insertValue: NewCottiModelDisplaySettings = {
      config: normalizedConfig,
      id: SETTINGS_ID,
      updatedBy: updatedBy ?? null,
    };

    const [settings] = await this.db
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
  };
}
