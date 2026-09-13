import { eq } from 'drizzle-orm';

import type {
  CottiHomeNotificationSettingsItem,
  NewCottiHomeNotificationSettings,
} from '../schemas';
import { cottiHomeNotificationSettings } from '../schemas';
import type { LobeChatDatabase } from '../type';

const SETTINGS_ID = 'default';
export const DEFAULT_COTTI_HOME_NOTIFICATION_CONTENT = '已进入待命状态\n带着新问题来了吧';

export interface CottiHomeNotificationConfig {
  content: string;
  enabled: boolean;
}

export class CottiHomeNotificationModel {
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase) {
    this.db = db;
  }

  getConfig = async (): Promise<CottiHomeNotificationConfig> => {
    const settings = await this.getSettings();

    return {
      content: settings?.content || DEFAULT_COTTI_HOME_NOTIFICATION_CONTENT,
      enabled: settings?.enabled ?? false,
    };
  };

  getSettings = async (): Promise<CottiHomeNotificationSettingsItem | undefined> => {
    const [settings] = await this.db
      .select()
      .from(cottiHomeNotificationSettings)
      .where(eq(cottiHomeNotificationSettings.id, SETTINGS_ID))
      .limit(1);

    return settings;
  };

  updateConfig = async (
    config: CottiHomeNotificationConfig,
    updatedBy?: string | null,
  ): Promise<CottiHomeNotificationSettingsItem> => {
    const content = config.content.trim() || DEFAULT_COTTI_HOME_NOTIFICATION_CONTENT;
    const insertValue: NewCottiHomeNotificationSettings = {
      content,
      enabled: config.enabled,
      id: SETTINGS_ID,
      updatedBy: updatedBy ?? null,
    };

    const [settings] = await this.db
      .insert(cottiHomeNotificationSettings)
      .values(insertValue)
      .onConflictDoUpdate({
        set: {
          content,
          enabled: config.enabled,
          updatedAt: new Date(),
          updatedBy: updatedBy ?? null,
        },
        target: cottiHomeNotificationSettings.id,
      })
      .returning();

    return settings;
  };
}
