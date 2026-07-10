import { eq } from 'drizzle-orm';

import type { ModelDisplayConfig, ModelDisplayItem } from '@/types/modelDisplay';

import type { CottiModelDisplaySettingsItem, NewCottiModelDisplaySettings } from '../schemas';
import { cottiModelDisplaySettings } from '../schemas';
import type { LobeChatDatabase } from '../type';

const SETTINGS_ID = 'default';

export const DEFAULT_COTTI_MODEL_DISPLAY_CONFIG: ModelDisplayConfig = {
  agent: [
    { displayName: 'COTTI-专业', enabled: true, model: 'gemini-3.5-flash', provider: 'vertexai' },
    {
      displayName: '豆包2.1-Pro',
      enabled: true,
      model: 'doubao-seed-2-1-pro-260628',
      provider: 'volcengine',
    },
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
      model: 'gemini-3.1-flash-lite',
      provider: 'vertexai',
    },
    { displayName: 'COTTI-专业', enabled: true, model: 'gemini-3.5-flash', provider: 'vertexai' },
    { displayName: '千问3.7-Plus', enabled: true, model: 'qwen3.7-plus', provider: 'qwen' },
    { displayName: 'GPT-5.6 Sol', enabled: true, model: 'gpt-5.6-sol', provider: 'azure' },
    { displayName: 'GPT-5.6 Terra', enabled: true, model: 'gpt-5.6-terra', provider: 'azure' },
    { displayName: 'GPT-5.6 Luna', enabled: true, model: 'gpt-5.6-luna', provider: 'azure' },
  ],
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

export const normalizeModelDisplayConfig = (config: ModelDisplayConfig): ModelDisplayConfig => ({
  agent: config.agent.map(normalizeItem).filter(Boolean) as ModelDisplayItem[],
  chat: config.chat.map(normalizeItem).filter(Boolean) as ModelDisplayItem[],
});

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

    return settings?.config || DEFAULT_COTTI_MODEL_DISPLAY_CONFIG;
  };

  getSettings = async (): Promise<CottiModelDisplaySettingsItem | undefined> => {
    const [settings] = await this.db
      .select()
      .from(cottiModelDisplaySettings)
      .where(eq(cottiModelDisplaySettings.id, SETTINGS_ID))
      .limit(1);

    return settings;
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
