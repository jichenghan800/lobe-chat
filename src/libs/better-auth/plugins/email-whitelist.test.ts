import { afterEach, describe, expect, it, vi } from 'vitest';

import { emailWhitelist } from './email-whitelist';

vi.mock('@/envs/auth', () => ({ authEnv: { AUTH_ALLOWED_EMAILS: 'cotticoffee.com' } }));

const user = { email: 'member@example.com', id: 'test-member', name: 'Member' };
const callback = { params: { providerId: 'generic-oidc' }, path: '/oauth2/callback/generic-oidc' };

async function createUser(context: unknown, isAllowed = vi.fn().mockResolvedValue(false)) {
  const plugin = emailWhitelist({ isAllowed });
  const config = await plugin.init!({} as never);
  return config!.options!.databaseHooks!.user!.create!.before!(user as never, context as never);
}

function portalEnvironment() {
  vi.stubEnv('COTTI_PORTAL_MANAGED_ACCESS', '1');
  vi.stubEnv('APP_URL', 'https://chat.cotti.ai');
  vi.stubEnv('AUTH_GENERIC_OIDC_ID', 'cotti-chat');
  vi.stubEnv(
    'AUTH_GENERIC_OIDC_ISSUER',
    'http://cotti-portal:3700/api/auth/.well-known/openid-configuration',
  );
}

afterEach(() => vi.unstubAllEnvs());

describe('portal registration admission', () => {
  it('accepts a central member after the configured Portal OAuth callback', async () => {
    portalEnvironment();
    const localWhitelist = vi.fn().mockResolvedValue(false);
    await expect(createUser(callback, localWhitelist)).resolves.toEqual({ data: user });
    expect(localWhitelist).not.toHaveBeenCalled();
  });

  it.each([
    null,
    { ...callback, path: '/sign-up/email' },
    { ...callback, path: '/sign-in/email-otp' },
    { ...callback, params: { providerId: 'feishu' } },
    { ...callback, path: '/oauth2/callback/feishu' },
  ])('keeps local admission for non-Portal creation: %j', async (context) => {
    portalEnvironment();
    await expect(createUser(context)).rejects.toMatchObject({
      body: { code: 'EMAIL_NOT_ALLOWED' },
    });
  });

  it.each([
    ['COTTI_PORTAL_MANAGED_ACCESS', ''],
    ['APP_URL', 'https://chatdev.cotticoffee.com'],
    ['AUTH_GENERIC_OIDC_ID', 'other-client'],
    ['AUTH_GENERIC_OIDC_ISSUER', 'https://untrusted.example/api/auth'],
  ])('does not delegate with an unrelated %s', async (key, value) => {
    portalEnvironment();
    vi.stubEnv(key, value);
    await expect(createUser(callback)).rejects.toMatchObject({
      body: { code: 'EMAIL_NOT_ALLOWED' },
    });
  });

  it('preserves existing local whitelist acceptance', async () => {
    await expect(createUser(null, vi.fn().mockResolvedValue(true))).resolves.toEqual({
      data: user,
    });
  });
});
