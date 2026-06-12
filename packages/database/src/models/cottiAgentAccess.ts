import { and, desc, eq, inArray } from 'drizzle-orm';

import type {
  CottiAgentAccessMode,
  CottiAgentAccessRuleItem,
  CottiAgentAccessRuleType,
  CottiAgentAccessSettingsItem,
  NewCottiAgentAccessRule,
} from '../schemas';
import { cottiAgentAccessRules, cottiAgentAccessSettings } from '../schemas';
import type { LobeChatDatabase } from '../type';

const SETTINGS_ID = 'default';

export interface CottiAgentAccessSubject {
  email?: string | null;
  normalizedEmail?: string | null;
  userId?: string | null;
}

export interface UpsertCottiAgentAccessRuleParams {
  createdBy?: string | null;
  note?: string | null;
  type: CottiAgentAccessRuleType;
  value: string;
}

export const normalizeCottiAgentAccessValue = (
  type: CottiAgentAccessRuleType,
  value: string | null | undefined,
) => {
  const normalized = value?.trim();
  if (!normalized) return '';

  return type === 'email' ? normalized.toLowerCase() : normalized;
};

export class CottiAgentAccessModel {
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase) {
    this.db = db;
  }

  getSettings = async (): Promise<CottiAgentAccessSettingsItem | undefined> => {
    const [settings] = await this.db
      .select()
      .from(cottiAgentAccessSettings)
      .where(eq(cottiAgentAccessSettings.id, SETTINGS_ID))
      .limit(1);

    return settings;
  };

  isSubjectAllowed = async (subject: CottiAgentAccessSubject): Promise<boolean> => {
    const candidates: Array<{ type: CottiAgentAccessRuleType; value: string }> = [];
    const userId = normalizeCottiAgentAccessValue('userId', subject.userId);
    const email = normalizeCottiAgentAccessValue('email', subject.email);
    const normalizedEmail = normalizeCottiAgentAccessValue('email', subject.normalizedEmail);

    if (userId) candidates.push({ type: 'userId', value: userId });
    if (email) candidates.push({ type: 'email', value: email });
    if (normalizedEmail && normalizedEmail !== email) {
      candidates.push({ type: 'email', value: normalizedEmail });
    }

    if (candidates.length === 0) return false;

    const emailValues = candidates
      .filter((candidate) => candidate.type === 'email')
      .map((candidate) => candidate.value);
    const userIdValues = candidates
      .filter((candidate) => candidate.type === 'userId')
      .map((candidate) => candidate.value);

    const checks = await Promise.all([
      emailValues.length > 0
        ? this.db
            .select({ id: cottiAgentAccessRules.id })
            .from(cottiAgentAccessRules)
            .where(
              and(
                eq(cottiAgentAccessRules.type, 'email'),
                eq(cottiAgentAccessRules.enabled, true),
                inArray(cottiAgentAccessRules.value, emailValues),
              ),
            )
            .limit(1)
        : [],
      userIdValues.length > 0
        ? this.db
            .select({ id: cottiAgentAccessRules.id })
            .from(cottiAgentAccessRules)
            .where(
              and(
                eq(cottiAgentAccessRules.type, 'userId'),
                eq(cottiAgentAccessRules.enabled, true),
                inArray(cottiAgentAccessRules.value, userIdValues),
              ),
            )
            .limit(1)
        : [],
    ]);

    return checks.some((items) => items.length > 0);
  };

  listRules = async (): Promise<CottiAgentAccessRuleItem[]> => {
    return this.db
      .select()
      .from(cottiAgentAccessRules)
      .orderBy(desc(cottiAgentAccessRules.createdAt));
  };

  setMode = async (
    mode: CottiAgentAccessMode,
    updatedBy?: string | null,
  ): Promise<CottiAgentAccessSettingsItem> => {
    const [settings] = await this.db
      .insert(cottiAgentAccessSettings)
      .values({
        id: SETTINGS_ID,
        mode,
        updatedBy: updatedBy ?? null,
      })
      .onConflictDoUpdate({
        set: {
          mode,
          updatedAt: new Date(),
          updatedBy: updatedBy ?? null,
        },
        target: cottiAgentAccessSettings.id,
      })
      .returning();

    return settings;
  };

  setRuleEnabled = async (
    id: string,
    enabled: boolean,
  ): Promise<CottiAgentAccessRuleItem | undefined> => {
    const [rule] = await this.db
      .update(cottiAgentAccessRules)
      .set({ enabled, updatedAt: new Date() })
      .where(eq(cottiAgentAccessRules.id, id))
      .returning();

    return rule;
  };

  removeRule = async (id: string): Promise<void> => {
    await this.db.delete(cottiAgentAccessRules).where(eq(cottiAgentAccessRules.id, id));
  };

  upsertRule = async (
    params: UpsertCottiAgentAccessRuleParams,
  ): Promise<CottiAgentAccessRuleItem> => {
    const value = normalizeCottiAgentAccessValue(params.type, params.value);
    const insertValue: NewCottiAgentAccessRule = {
      createdBy: params.createdBy ?? null,
      enabled: true,
      note: params.note?.trim() || null,
      type: params.type,
      value,
    };

    const [rule] = await this.db
      .insert(cottiAgentAccessRules)
      .values(insertValue)
      .onConflictDoUpdate({
        set: {
          enabled: true,
          note: insertValue.note,
          updatedAt: new Date(),
        },
        target: [cottiAgentAccessRules.type, cottiAgentAccessRules.value],
      })
      .returning();

    return rule;
  };
}
