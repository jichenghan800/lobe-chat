import { TRPCError } from '@trpc/server';
import { desc, eq, ilike, inArray, or } from 'drizzle-orm';

import {
  CottiLoginAccessModel,
  normalizeCottiLoginAccessValue,
} from '@/database/models/cottiLoginAccess';
import { CottiPlatformAdminModel } from '@/database/models/cottiPlatformAdmin';
import { CottiUserLoginControlModel } from '@/database/models/cottiUserLoginControl';
import type { CottiLoginAccessMode, CottiLoginAccessRuleType } from '@/database/schemas';
import { users } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import { createSecondaryStorage } from '@/libs/better-auth/utils/config';
import { revokeOIDCArtifactsByUserId } from '@/libs/oidc-provider/access-control';
import type {
  CottiLoginAccessRule,
  CottiLoginAccessUser,
  CottiPeopleManagementDetail,
  CottiPlatformAdministrator,
} from '@/types/cotti/peopleManagement';

import { CottiPlatformAdminAccessService, parseCottiPlatformAdminEmails } from './adminAccess';

interface UpsertLoginRuleParams {
  note?: string;
  type: CottiLoginAccessRuleType;
  value: string;
}

const parseRegistrationEnvironment = (raw = process.env.AUTH_ALLOWED_EMAILS) => {
  const rules = new Map<string, { type: CottiLoginAccessRuleType; value: string }>();

  for (const rawValue of (raw || '').split(/[,;\n]/)) {
    const type: CottiLoginAccessRuleType = rawValue.includes('@') ? 'email' : 'domain';
    const value = normalizeCottiLoginAccessValue(type, rawValue);
    if (value) rules.set(`${type}:${value}`, { type, value });
  }

  return [...rules.values()];
};

export const isRegistrationAllowedByEnvironment = (
  email: string,
  raw = process.env.AUTH_ALLOWED_EMAILS,
) => {
  const rules = parseRegistrationEnvironment(raw);
  if (rules.length === 0) return true;

  const normalizedEmail = normalizeCottiLoginAccessValue('email', email);
  const domain = normalizedEmail.split('@')[1] || '';

  return rules.some((rule) =>
    rule.type === 'email' ? rule.value === normalizedEmail : rule.value === domain,
  );
};

export class CottiPeopleManagementService {
  private loginAccessModel: CottiLoginAccessModel;
  private platformAdminModel: CottiPlatformAdminModel;

  constructor(
    private db: LobeChatDatabase,
    private userId?: string,
    models?: {
      loginAccessModel?: CottiLoginAccessModel;
      platformAdminModel?: CottiPlatformAdminModel;
      userLoginControlModel?: CottiUserLoginControlModel;
    },
  ) {
    this.loginAccessModel = models?.loginAccessModel ?? new CottiLoginAccessModel(db);
    this.platformAdminModel = models?.platformAdminModel ?? new CottiPlatformAdminModel(db);
    this.userLoginControlModel =
      models?.userLoginControlModel ?? new CottiUserLoginControlModel(db);
  }

  private userLoginControlModel: CottiUserLoginControlModel;

  async searchUsers(query: string) {
    const pattern = `%${query.trim()}%`;
    if (query.trim().length < 2) return [];
    return this.db
      .select({
        id: users.id,
        email: users.email,
        normalizedEmail: users.normalizedEmail,
        fullName: users.fullName,
        username: users.username,
      })
      .from(users)
      .where(
        or(
          ilike(users.email, pattern),
          ilike(users.normalizedEmail, pattern),
          ilike(users.fullName, pattern),
          ilike(users.username, pattern),
        ),
      )
      .orderBy(desc(users.lastActiveAt))
      .limit(20);
  }

  async addAdministrator(targetUserId: string, note?: string) {
    const [targetUser] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);
    if (!targetUser) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Platform user not found' });
    }

    return this.platformAdminModel.add(targetUserId, this.userId, note);
  }

  async getDetail(): Promise<CottiPeopleManagementDetail> {
    const [settings, databaseRules, databaseAdministrators, disabledLoginUsers] = await Promise.all(
      [
        this.loginAccessModel.getSettings(),
        this.loginAccessModel.listRules(),
        this.platformAdminModel.list(),
        this.userLoginControlModel.listDisabled(),
      ],
    );
    const loginSource = settings ? 'database' : 'environment';
    const environmentRules = parseRegistrationEnvironment();
    const environmentAdminEmails = [...parseCottiPlatformAdminEmails()].filter(
      (email) => email !== '*',
    );
    const environmentUsers = await this.findUsersByEmails(environmentAdminEmails);
    const usersByEmail = new Map<string, CottiLoginAccessUser>();

    for (const user of environmentUsers) {
      for (const email of [user.email, user.normalizedEmail]) {
        const normalized = normalizeCottiLoginAccessValue('email', email);
        if (normalized) usersByEmail.set(normalized, user);
      }
    }

    const rules: CottiLoginAccessRule[] = settings
      ? databaseRules.map((rule) => ({ ...rule, source: 'database' }))
      : environmentRules.map((rule) => ({
          createdAt: null,
          enabled: true,
          id: `environment:${rule.type}:${rule.value}`,
          note: null,
          source: 'environment',
          type: rule.type,
          updatedAt: null,
          user: null,
          value: rule.value,
        }));
    const administrators: CottiPlatformAdministrator[] = [
      ...databaseAdministrators.map((assignment) => ({
        createdAt: assignment.createdAt,
        editable: true,
        id: assignment.id,
        note: assignment.note,
        source: 'database' as const,
        user: assignment.user,
        userId: assignment.userId,
        value:
          assignment.user.normalizedEmail ||
          assignment.user.email ||
          assignment.user.username ||
          assignment.userId,
      })),
      ...environmentAdminEmails.map((email) => ({
        createdAt: null,
        editable: false,
        id: `environment:${email}`,
        note: null,
        source: 'environment' as const,
        user: usersByEmail.get(email) || null,
        userId: usersByEmail.get(email)?.id || null,
        value: email,
      })),
    ];

    if (parseCottiPlatformAdminEmails().has('*')) {
      administrators.push({
        createdAt: null,
        editable: false,
        id: 'environment:*',
        note: null,
        source: 'environment',
        user: null,
        userId: null,
        value: '*',
      });
    }

    return {
      administrators,
      disabledLoginUsers,
      loginAccess: {
        mode: settings?.mode ?? (environmentRules.length === 0 ? 'open' : 'allowlist'),
        rules,
        source: loginSource,
      },
    };
  }

  async isRegistrationAllowed(email: string) {
    try {
      const settings = await this.loginAccessModel.getSettings();
      if (!settings) return isRegistrationAllowedByEnvironment(email);
      if (settings.mode === 'open') return true;

      return this.loginAccessModel.isEmailAllowed(email);
    } catch (error) {
      console.error('[CottiPeopleManagement] Falling back to AUTH_ALLOWED_EMAILS:', error);
      return isRegistrationAllowedByEnvironment(email);
    }
  }

  async removeAdministrator(id: string) {
    const removed = await this.platformAdminModel.remove(id);
    if (!removed) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'At least one database platform administrator must remain',
      });
    }
  }

  async removeLoginRule(id: string) {
    await this.ensureDatabaseLoginAccess();

    const environmentRule = this.parseEnvironmentLoginRuleId(id);
    if (environmentRule) {
      await this.loginAccessModel.removeRuleByValue(environmentRule.type, environmentRule.value);
      return;
    }

    await this.loginAccessModel.removeRule(id);
  }

  async setLoginMode(mode: CottiLoginAccessMode) {
    await this.ensureDatabaseLoginAccess();
    return this.loginAccessModel.setMode(mode, this.userId);
  }

  async setLoginRuleEnabled(id: string, enabled: boolean) {
    await this.ensureDatabaseLoginAccess();
    const rule = await this.loginAccessModel.setRuleEnabled(id, enabled);
    if (!rule) throw new TRPCError({ code: 'NOT_FOUND', message: 'Login access rule not found' });

    return rule;
  }

  async setUserLoginDisabled(targetUserId: string, disabled: boolean, reason?: string) {
    if (disabled && targetUserId === this.userId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'You cannot disable your own login' });
    }
    if (disabled && (await this.isProtectedPlatformAdministrator(targetUserId))) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Remove platform administrator access before disabling this user',
      });
    }

    const result = await this.userLoginControlModel.setLoginDisabled(
      targetUserId,
      disabled,
      reason,
    );
    if (!result) throw new TRPCError({ code: 'NOT_FOUND', message: 'Platform user not found' });

    if (disabled) {
      const cleanupResults = await Promise.allSettled([
        this.revokeSecondarySessions(targetUserId, result.sessionTokens),
        revokeOIDCArtifactsByUserId(this.db, targetUserId),
      ]);
      for (const cleanupResult of cleanupResults) {
        if (cleanupResult.status === 'rejected') {
          console.error(
            '[CottiPeopleManagement] Failed to revoke a disabled user session:',
            cleanupResult.reason,
          );
        }
      }
    }

    return result.user;
  }

  async upsertLoginRule({ note, type, value }: UpsertLoginRuleParams) {
    await this.ensureDatabaseLoginAccess();
    const normalized = normalizeCottiLoginAccessValue(type, value);
    if (!normalized) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Login access rule is empty' });
    }

    return this.loginAccessModel.upsertRule({
      createdBy: this.userId,
      note,
      type,
      value: normalized,
    });
  }

  private async ensureDatabaseLoginAccess() {
    const settings = await this.loginAccessModel.getSettings();
    if (settings) return;

    const rules = parseRegistrationEnvironment();
    await this.loginAccessModel.initialize({
      mode: rules.length === 0 ? 'open' : 'allowlist',
      rules,
      updatedBy: this.userId,
    });
  }

  private async findUsersByEmails(emails: string[]): Promise<CottiLoginAccessUser[]> {
    if (emails.length === 0) return [];

    return this.db
      .select({
        email: users.email,
        fullName: users.fullName,
        id: users.id,
        normalizedEmail: users.normalizedEmail,
        username: users.username,
      })
      .from(users)
      .where(or(inArray(users.email, emails), inArray(users.normalizedEmail, emails)));
  }

  private parseEnvironmentLoginRuleId(
    id: string,
  ): { type: CottiLoginAccessRuleType; value: string } | undefined {
    if (!id.startsWith('environment:')) return;

    const [, type, ...valueParts] = id.split(':');
    if (type !== 'domain' && type !== 'email') return;

    const value = normalizeCottiLoginAccessValue(type, valueParts.join(':'));
    if (!value) return;

    return { type, value };
  }

  private async isProtectedPlatformAdministrator(userId: string) {
    try {
      const identity = await new CottiPlatformAdminAccessService(this.db, userId).requireAccess();
      return identity.source !== 'wildcard';
    } catch (error) {
      if (error instanceof TRPCError && error.code === 'FORBIDDEN') return false;
      throw error;
    }
  }

  private async revokeSecondarySessions(userId: string, sessionTokens: string[]) {
    const secondaryStorage = createSecondaryStorage();
    if (!secondaryStorage) return;

    await Promise.all([
      ...sessionTokens.map((token) => secondaryStorage.delete(token)),
      secondaryStorage.delete(`active-sessions-${userId}`),
    ]);
  }
}
