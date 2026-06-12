import type { LobeAgentChatConfig } from '@lobechat/types';
import type { PartialDeep } from 'type-fest';

export type CottiAgentAccessMode = 'allowlist' | 'off' | 'open';

export interface CottiAgentAccessSubject {
  email?: string | null;
  normalizedEmail?: string | null;
  userId?: string | null;
}

const COTTI_AGENT_ACCESS_MODES = new Set<CottiAgentAccessMode>(['allowlist', 'off', 'open']);

const parseList = (raw: string | undefined) =>
  new Set(
    (raw || '')
      .split(/[,;\n]/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );

const normalizeMode = (raw: string | undefined): CottiAgentAccessMode => {
  const value = raw?.trim().toLowerCase();

  if (value && COTTI_AGENT_ACCESS_MODES.has(value as CottiAgentAccessMode)) {
    return value as CottiAgentAccessMode;
  }

  return 'allowlist';
};

const normalizeIdentity = (value: string | null | undefined) => value?.trim().toLowerCase() || '';

export const getCottiAgentAccessMode = () => normalizeMode(process.env.COTTI_AGENT_ACCESS_MODE);

export const isCottiAgentAccessEnabledForSubjectFromEnv = (subject: CottiAgentAccessSubject) => {
  const mode = getCottiAgentAccessMode();

  if (mode === 'open') return true;
  if (mode === 'off') return false;

  const allowedUserIds = parseList(process.env.COTTI_AGENT_ALLOWED_USER_IDS);
  const allowedEmails = parseList(process.env.COTTI_AGENT_ALLOWED_EMAILS);

  const userId = normalizeIdentity(subject.userId);
  const email = normalizeIdentity(subject.email);
  const normalizedEmail = normalizeIdentity(subject.normalizedEmail);

  return (
    (!!userId && allowedUserIds.has(userId)) ||
    (!!email && allowedEmails.has(email)) ||
    (!!normalizedEmail && allowedEmails.has(normalizedEmail))
  );
};

export const isCottiAgentAccessEnabledForSubject = isCottiAgentAccessEnabledForSubjectFromEnv;

const isRecord = (value: unknown): value is Record<PropertyKey, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const containsCottiAgentModeEnable = (value: unknown) => {
  if (!isRecord(value)) return false;

  const chatConfig = value.chatConfig;
  if (!isRecord(chatConfig)) return false;

  return chatConfig.enableAgentMode === true;
};

interface CottiAgentConfigLike {
  chatConfig?: PartialDeep<LobeAgentChatConfig> | null;
}

export const forceCottiChatOnlyAgentConfig = <T extends CottiAgentConfigLike>(config: T): T => {
  const chatConfig = config.chatConfig ?? {};
  const runtimeEnv = chatConfig.runtimeEnv ?? {};
  const runtimeMode = runtimeEnv.runtimeMode ?? {};

  return {
    ...config,
    chatConfig: {
      ...chatConfig,
      enableAgentMode: false,
      runtimeEnv: {
        ...runtimeEnv,
        runtimeMode: {
          ...runtimeMode,
          desktop: 'none',
          web: 'none',
        },
      },
    },
  } as T;
};
