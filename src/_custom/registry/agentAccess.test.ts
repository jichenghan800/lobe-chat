import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  containsCottiAgentModeEnable,
  forceCottiChatOnlyAgentConfig,
  getCottiAgentAccessMode,
  isCottiAgentAccessEnabledForSubject,
} from './agentAccess';

describe('agentAccess', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to allowlist mode', () => {
    expect(getCottiAgentAccessMode()).toBe('allowlist');
    expect(isCottiAgentAccessEnabledForSubject({ userId: 'u1' })).toBe(false);
  });

  it('allows users by id or email in allowlist mode', () => {
    vi.stubEnv('COTTI_AGENT_ALLOWED_USER_IDS', 'u1; u2');
    vi.stubEnv('COTTI_AGENT_ALLOWED_EMAILS', 'alice@example.com, bob@example.com');

    expect(isCottiAgentAccessEnabledForSubject({ userId: 'U1' })).toBe(true);
    expect(isCottiAgentAccessEnabledForSubject({ email: 'ALICE@example.com' })).toBe(true);
    expect(isCottiAgentAccessEnabledForSubject({ normalizedEmail: 'bob@example.com' })).toBe(true);
    expect(isCottiAgentAccessEnabledForSubject({ userId: 'u3' })).toBe(false);
  });

  it('allows email entries by mailbox prefix across domains', () => {
    vi.stubEnv('COTTI_AGENT_ALLOWED_EMAILS', 'jicheng.han@cotticoffee.com');

    expect(isCottiAgentAccessEnabledForSubject({ email: 'jicheng.han@abite.com' })).toBe(true);
    expect(isCottiAgentAccessEnabledForSubject({ email: 'other.han@cotticoffee.com' })).toBe(false);
  });

  it('supports open and off modes', () => {
    vi.stubEnv('COTTI_AGENT_ACCESS_MODE', 'open');
    expect(isCottiAgentAccessEnabledForSubject({})).toBe(true);

    vi.stubEnv('COTTI_AGENT_ACCESS_MODE', 'off');
    vi.stubEnv('COTTI_AGENT_ALLOWED_USER_IDS', 'u1');
    expect(isCottiAgentAccessEnabledForSubject({ userId: 'u1' })).toBe(false);
  });

  it('detects attempts to enable agent mode', () => {
    expect(containsCottiAgentModeEnable({ chatConfig: { enableAgentMode: true } })).toBe(true);
    expect(containsCottiAgentModeEnable({ chatConfig: { enableAgentMode: false } })).toBe(false);
    expect(containsCottiAgentModeEnable({ enableAgentMode: true })).toBe(false);
  });

  it('forces agent config to chat-only', () => {
    const config = forceCottiChatOnlyAgentConfig({
      chatConfig: {
        enableAgentMode: true,
      },
      model: 'gemini-3.5-flash',
    });

    expect(config.chatConfig?.enableAgentMode).toBe(false);
  });
});
