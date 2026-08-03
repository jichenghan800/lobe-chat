import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import {
  CottiAgentAccessModel,
  normalizeCottiAgentAccessEmailPrefix,
  normalizeCottiAgentAccessValue,
} from '@/database/models/cottiAgentAccess';
import type {
  CottiAgentAccessMode,
  CottiAgentAccessRuleItem,
  CottiAgentAccessRuleType,
} from '@/database/schemas';
import { users } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

export type CottiAgentModeVisibilitySource = 'database' | 'environment';

export interface CottiAgentModeVisibilityEnvironment {
  allowedEmails?: string;
  allowedUserIds?: string;
  mode?: string;
}

export interface CottiAgentModeVisibilitySubject {
  email?: null | string;
  normalizedEmail?: null | string;
  userId?: null | string;
}

export interface CottiAgentModeVisibilityDetail {
  mode: CottiAgentAccessMode;
  rules: CottiAgentAccessRuleItem[];
  source: CottiAgentModeVisibilitySource;
}

interface UpsertCottiAgentModeVisibilityRuleParams {
  note?: string;
  type: CottiAgentAccessRuleType;
  value: string;
}

export type CottiAgentModeVisibilityStore = Pick<
  CottiAgentAccessModel,
  | 'getSettings'
  | 'isSubjectAllowed'
  | 'listRules'
  | 'removeRule'
  | 'searchUsers'
  | 'setMode'
  | 'setRuleEnabled'
  | 'upsertRule'
>;

const COTTI_AGENT_ACCESS_MODES = new Set<CottiAgentAccessMode>(['allowlist', 'off', 'open']);

const normalizeIdentity = (value: null | string | undefined) => value?.trim().toLowerCase() || '';

const parseList = (raw: string | undefined) =>
  new Set(
    (raw || '')
      .split(/[,;\n]/)
      .map(normalizeIdentity)
      .filter(Boolean),
  );

export const getCottiAgentModeVisibilityEnvironment = (): CottiAgentModeVisibilityEnvironment => ({
  allowedEmails: process.env.COTTI_AGENT_ALLOWED_EMAILS,
  allowedUserIds: process.env.COTTI_AGENT_ALLOWED_USER_IDS,
  mode: process.env.COTTI_AGENT_ACCESS_MODE,
});

export const resolveCottiAgentAccessMode = (raw: string | undefined): CottiAgentAccessMode => {
  const mode = normalizeIdentity(raw);

  return COTTI_AGENT_ACCESS_MODES.has(mode as CottiAgentAccessMode)
    ? (mode as CottiAgentAccessMode)
    : 'allowlist';
};

export const resolveCottiAgentModeVisibilityFromEnvironment = ({
  environment,
  subject,
}: {
  environment: CottiAgentModeVisibilityEnvironment;
  subject: CottiAgentModeVisibilitySubject;
}) => {
  const mode = resolveCottiAgentAccessMode(environment.mode);

  if (mode === 'open') return true;
  if (mode === 'off') return false;

  const allowedUserIds = parseList(environment.allowedUserIds);
  const allowedEmails = parseList(environment.allowedEmails);
  const allowedEmailPrefixes = new Set(
    [...allowedEmails].map((email) => normalizeCottiAgentAccessEmailPrefix(email)).filter(Boolean),
  );
  const userId = normalizeIdentity(subject.userId);
  const emails = [subject.email, subject.normalizedEmail]
    .map((email) => normalizeCottiAgentAccessValue('email', email))
    .filter(Boolean);

  return (
    (!!userId && allowedUserIds.has(userId)) ||
    emails.some(
      (email) =>
        allowedEmails.has(email) ||
        allowedEmailPrefixes.has(normalizeCottiAgentAccessEmailPrefix(email)),
    )
  );
};

export class CottiAgentModeVisibilityService {
  private accessModel: CottiAgentModeVisibilityStore;
  private db: LobeChatDatabase;
  private userId: string;
  private visibilityPromise?: Promise<boolean>;

  constructor(
    db: LobeChatDatabase,
    userId: string,
    accessModel: CottiAgentModeVisibilityStore = new CottiAgentAccessModel(db),
  ) {
    this.accessModel = accessModel;
    this.db = db;
    this.userId = userId;
  }

  async getDetail(): Promise<CottiAgentModeVisibilityDetail> {
    const [settings, rules] = await Promise.all([
      this.accessModel.getSettings(),
      this.accessModel.listRules(),
    ]);

    return {
      mode:
        settings?.mode ??
        resolveCottiAgentAccessMode(getCottiAgentModeVisibilityEnvironment().mode),
      rules,
      source: settings ? 'database' : 'environment',
    };
  }

  async getVisibility() {
    this.visibilityPromise ??= this.resolveVisibility();

    return this.visibilityPromise;
  }

  async removeRule(id: string) {
    await this.accessModel.removeRule(id);
  }

  async searchUsers(query: string) {
    return this.accessModel.searchUsers(query, 8);
  }

  async setMode(mode: CottiAgentAccessMode) {
    return this.accessModel.setMode(mode, this.userId);
  }

  async setRuleEnabled(id: string, enabled: boolean) {
    return this.accessModel.setRuleEnabled(id, enabled);
  }

  async upsertRule({ note, type, value }: UpsertCottiAgentModeVisibilityRuleParams) {
    const normalizedValue = normalizeCottiAgentAccessValue(type, value);
    if (!normalizedValue) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Agent mode visibility rule value is empty',
      });
    }

    return this.accessModel.upsertRule({
      createdBy: this.userId,
      note,
      type,
      value: normalizedValue,
    });
  }

  private async getSubject(): Promise<CottiAgentModeVisibilitySubject> {
    const [user] = await this.db
      .select({ email: users.email, normalizedEmail: users.normalizedEmail })
      .from(users)
      .where(eq(users.id, this.userId))
      .limit(1);

    return {
      email: user?.email,
      normalizedEmail: user?.normalizedEmail,
      userId: this.userId,
    };
  }

  private async resolveVisibility() {
    const settings = await this.accessModel.getSettings();

    if (settings?.mode === 'open') return true;
    if (settings?.mode === 'off') return false;

    const environment = getCottiAgentModeVisibilityEnvironment();
    const environmentMode = resolveCottiAgentAccessMode(environment.mode);

    if (!settings && environmentMode === 'open') return true;
    if (!settings && environmentMode === 'off') return false;

    const subject = await this.getSubject();
    const databaseVisible = await this.accessModel.isSubjectAllowed(subject);

    if (settings) return databaseVisible;
    if (databaseVisible) return true;

    return resolveCottiAgentModeVisibilityFromEnvironment({ environment, subject });
  }
}
