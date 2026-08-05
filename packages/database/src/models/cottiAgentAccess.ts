import { and, desc, eq, ilike, inArray, or } from 'drizzle-orm';

import type {
  CottiAgentAccessMode,
  CottiAgentAccessRuleItem,
  CottiAgentAccessRuleType,
  CottiAgentAccessSettingsItem,
  NewCottiAgentAccessRule,
} from '../schemas';
import { cottiAgentAccessRules, cottiAgentAccessSettings, users } from '../schemas';
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

export interface CottiAgentAccessUserSuggestion {
  email: null | string;
  fullName: null | string;
  id: string;
  normalizedEmail: null | string;
  role: null | string;
  username: null | string;
}

export interface CottiAgentAccessRuleWithUser extends CottiAgentAccessRuleItem {
  user: CottiAgentAccessUserSuggestion | null;
}

export const normalizeCottiAgentAccessValue = (
  type: CottiAgentAccessRuleType,
  value: string | null | undefined,
) => {
  const normalized = value?.trim();
  if (!normalized) return '';

  return type === 'email' ? normalized.toLowerCase() : normalized;
};

export const normalizeCottiAgentAccessEmailPrefix = (value: string | null | undefined) => {
  const email = normalizeCottiAgentAccessValue('email', value);
  if (!email) return '';

  return email.split('@')[0];
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

    const emailValues = candidates
      .filter((candidate) => candidate.type === 'email')
      .map((candidate) => candidate.value);
    const emailPrefixes = new Set(
      emailValues.map((value) => normalizeCottiAgentAccessEmailPrefix(value)).filter(Boolean),
    );
    const userIdValues = candidates
      .filter((candidate) => candidate.type === 'userId')
      .map((candidate) => candidate.value);

    if (emailPrefixes.size === 0 && userIdValues.length === 0) return false;

    const checks = await Promise.all([
      emailPrefixes.size > 0
        ? this.db
            .select({ id: cottiAgentAccessRules.id, value: cottiAgentAccessRules.value })
            .from(cottiAgentAccessRules)
            .where(
              and(eq(cottiAgentAccessRules.type, 'email'), eq(cottiAgentAccessRules.enabled, true)),
            )
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

    const [emailRules, userRules] = checks;
    const emailAllowed = emailRules.some((rule) =>
      emailPrefixes.has(normalizeCottiAgentAccessEmailPrefix(rule.value)),
    );

    return emailAllowed || userRules.length > 0;
  };

  listRules = async (): Promise<CottiAgentAccessRuleWithUser[]> => {
    const rules = await this.db
      .select()
      .from(cottiAgentAccessRules)
      .orderBy(desc(cottiAgentAccessRules.createdAt));

    if (rules.length === 0) return [];

    const emailValues = rules
      .filter((rule) => rule.type === 'email')
      .map((rule) => normalizeCottiAgentAccessValue('email', rule.value));
    const userIdValues = rules.filter((rule) => rule.type === 'userId').map((rule) => rule.value);
    const userConditions = [
      emailValues.length > 0 ? inArray(users.email, emailValues) : undefined,
      emailValues.length > 0 ? inArray(users.normalizedEmail, emailValues) : undefined,
      userIdValues.length > 0 ? inArray(users.id, userIdValues) : undefined,
    ].filter((condition) => condition !== undefined);

    const matchedUsers =
      userConditions.length > 0
        ? await this.db
            .select({
              email: users.email,
              fullName: users.fullName,
              id: users.id,
              normalizedEmail: users.normalizedEmail,
              role: users.role,
              username: users.username,
            })
            .from(users)
            .where(or(...userConditions))
        : [];
    const usersById = new Map(matchedUsers.map((user) => [user.id, user]));
    const usersByEmail = new Map<string, CottiAgentAccessUserSuggestion>();

    for (const user of matchedUsers) {
      for (const email of [user.email, user.normalizedEmail]) {
        const normalizedEmail = normalizeCottiAgentAccessValue('email', email);
        if (normalizedEmail) usersByEmail.set(normalizedEmail, user);
      }
    }

    return rules.map((rule) => ({
      ...rule,
      user:
        rule.type === 'userId'
          ? usersById.get(rule.value) || null
          : usersByEmail.get(normalizeCottiAgentAccessValue('email', rule.value)) || null,
    }));
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

  searchUsers = async (rawQuery: string, limit = 8): Promise<CottiAgentAccessUserSuggestion[]> => {
    const query = rawQuery.trim();
    if (query.length < 2) return [];

    const matchedPattern = `%${query}%`;
    const safeLimit = Math.min(Math.max(limit, 1), 20);

    return this.db
      .select({
        email: users.email,
        fullName: users.fullName,
        id: users.id,
        normalizedEmail: users.normalizedEmail,
        role: users.role,
        username: users.username,
      })
      .from(users)
      .where(
        or(
          ilike(users.email, matchedPattern),
          ilike(users.normalizedEmail, matchedPattern),
          ilike(users.username, matchedPattern),
          ilike(users.fullName, matchedPattern),
          ilike(users.id, matchedPattern),
        ),
      )
      .orderBy(desc(users.lastActiveAt))
      .limit(safeLimit);
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
