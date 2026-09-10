import { and, desc, eq, inArray, or } from 'drizzle-orm';

import type {
  CottiLoginAccessMode,
  CottiLoginAccessRuleItem,
  CottiLoginAccessRuleType,
  CottiLoginAccessSettingsItem,
  NewCottiLoginAccessRule,
} from '../schemas';
import { cottiLoginAccessRules, cottiLoginAccessSettings, users } from '../schemas';
import type { LobeChatDatabase } from '../type';

const SETTINGS_ID = 'default';

export interface CottiLoginAccessRuleWithUser extends CottiLoginAccessRuleItem {
  user: {
    email: null | string;
    fullName: null | string;
    id: string;
    normalizedEmail: null | string;
    username: null | string;
  } | null;
}

export interface InitializeCottiLoginAccessParams {
  mode: CottiLoginAccessMode;
  rules: Array<{ type: CottiLoginAccessRuleType; value: string }>;
  updatedBy?: null | string;
}

export interface UpsertCottiLoginAccessRuleParams {
  createdBy?: null | string;
  note?: null | string;
  type: CottiLoginAccessRuleType;
  value: string;
}

export const normalizeCottiLoginAccessValue = (
  type: CottiLoginAccessRuleType,
  rawValue: null | string | undefined,
) => {
  const value = rawValue?.trim().toLowerCase() || '';
  if (!value) return '';

  return type === 'domain' ? value.replace(/^@/, '') : value;
};

export class CottiLoginAccessModel {
  constructor(private db: LobeChatDatabase) {}

  async getSettings(): Promise<CottiLoginAccessSettingsItem | undefined> {
    const [settings] = await this.db
      .select()
      .from(cottiLoginAccessSettings)
      .where(eq(cottiLoginAccessSettings.id, SETTINGS_ID))
      .limit(1);

    return settings;
  }

  async initialize({ mode, rules, updatedBy }: InitializeCottiLoginAccessParams) {
    await this.db.transaction(async (tx) => {
      await tx
        .insert(cottiLoginAccessSettings)
        .values({ id: SETTINGS_ID, mode, updatedBy: updatedBy ?? null })
        .onConflictDoNothing({ target: cottiLoginAccessSettings.id });

      if (rules.length === 0) return;

      await tx
        .insert(cottiLoginAccessRules)
        .values(
          rules.map((rule) => ({
            createdBy: updatedBy ?? null,
            type: rule.type,
            value: normalizeCottiLoginAccessValue(rule.type, rule.value),
          })),
        )
        .onConflictDoNothing({
          target: [cottiLoginAccessRules.type, cottiLoginAccessRules.value],
        });
    });
  }

  async isEmailAllowed(rawEmail: string) {
    const email = normalizeCottiLoginAccessValue('email', rawEmail);
    const domain = email.split('@')[1] || '';
    if (!email || !domain) return false;

    const rows = await this.db
      .select({ id: cottiLoginAccessRules.id })
      .from(cottiLoginAccessRules)
      .where(
        and(
          eq(cottiLoginAccessRules.enabled, true),
          or(
            and(eq(cottiLoginAccessRules.type, 'email'), eq(cottiLoginAccessRules.value, email)),
            and(eq(cottiLoginAccessRules.type, 'domain'), eq(cottiLoginAccessRules.value, domain)),
          ),
        ),
      )
      .limit(1);

    return rows.length > 0;
  }

  async listRules(): Promise<CottiLoginAccessRuleWithUser[]> {
    const rules = await this.db
      .select()
      .from(cottiLoginAccessRules)
      .orderBy(desc(cottiLoginAccessRules.createdAt));
    const emailValues = rules.filter((rule) => rule.type === 'email').map((rule) => rule.value);

    const matchedUsers =
      emailValues.length > 0
        ? await this.db
            .select({
              email: users.email,
              fullName: users.fullName,
              id: users.id,
              normalizedEmail: users.normalizedEmail,
              username: users.username,
            })
            .from(users)
            .where(
              or(inArray(users.email, emailValues), inArray(users.normalizedEmail, emailValues)),
            )
        : [];
    const usersByEmail = new Map<string, (typeof matchedUsers)[number]>();

    for (const user of matchedUsers) {
      for (const email of [user.email, user.normalizedEmail]) {
        const normalized = normalizeCottiLoginAccessValue('email', email);
        if (normalized) usersByEmail.set(normalized, user);
      }
    }

    return rules.map((rule) => ({
      ...rule,
      user:
        rule.type === 'email'
          ? usersByEmail.get(normalizeCottiLoginAccessValue('email', rule.value)) || null
          : null,
    }));
  }

  async removeRule(id: string) {
    await this.db.delete(cottiLoginAccessRules).where(eq(cottiLoginAccessRules.id, id));
  }

  async removeRuleByValue(type: CottiLoginAccessRuleType, rawValue: string) {
    const value = normalizeCottiLoginAccessValue(type, rawValue);

    await this.db
      .delete(cottiLoginAccessRules)
      .where(and(eq(cottiLoginAccessRules.type, type), eq(cottiLoginAccessRules.value, value)));
  }

  async setMode(mode: CottiLoginAccessMode, updatedBy?: null | string) {
    const [settings] = await this.db
      .insert(cottiLoginAccessSettings)
      .values({ id: SETTINGS_ID, mode, updatedBy: updatedBy ?? null })
      .onConflictDoUpdate({
        set: { mode, updatedAt: new Date(), updatedBy: updatedBy ?? null },
        target: cottiLoginAccessSettings.id,
      })
      .returning();

    return settings;
  }

  async setRuleEnabled(id: string, enabled: boolean) {
    const [rule] = await this.db
      .update(cottiLoginAccessRules)
      .set({ enabled, updatedAt: new Date() })
      .where(eq(cottiLoginAccessRules.id, id))
      .returning();

    return rule;
  }

  async upsertRule(params: UpsertCottiLoginAccessRuleParams) {
    const value = normalizeCottiLoginAccessValue(params.type, params.value);
    const insertValue: NewCottiLoginAccessRule = {
      createdBy: params.createdBy ?? null,
      enabled: true,
      note: params.note?.trim() || null,
      type: params.type,
      value,
    };
    const [rule] = await this.db
      .insert(cottiLoginAccessRules)
      .values(insertValue)
      .onConflictDoUpdate({
        set: { enabled: true, note: insertValue.note, updatedAt: new Date() },
        target: [cottiLoginAccessRules.type, cottiLoginAccessRules.value],
      })
      .returning();

    return rule;
  }
}
