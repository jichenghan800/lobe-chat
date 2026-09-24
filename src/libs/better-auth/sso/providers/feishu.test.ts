import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { initBetterAuthSSOProviders } from '..';
import Feishu, { FeishuBlue } from './feishu';

const { mockAuthEnv } = vi.hoisted(() => ({
  mockAuthEnv: {
    AUTH_FEISHU_APP_ID: 'feishu-client-id' as string | undefined,
    AUTH_FEISHU_APP_SECRET: 'feishu-client-secret' as string | undefined,
    AUTH_FEISHU_BLUE_APP_ID: 'feishu-blue-client-id' as string | undefined,
    AUTH_FEISHU_BLUE_APP_SECRET: 'feishu-blue-client-secret' as string | undefined,
    AUTH_SSO_PROVIDERS: 'feishu,feishu-blue',
  },
}));

vi.mock('@/envs/app', () => ({
  appEnv: { APP_URL: 'https://chat.example.com' },
}));

vi.mock('@/envs/auth', () => ({ authEnv: mockAuthEnv }));

describe('Feishu SSO providers', () => {
  beforeEach(() => {
    mockAuthEnv.AUTH_FEISHU_APP_ID = 'feishu-client-id';
    mockAuthEnv.AUTH_FEISHU_APP_SECRET = 'feishu-client-secret';
    mockAuthEnv.AUTH_FEISHU_BLUE_APP_ID = 'feishu-blue-client-id';
    mockAuthEnv.AUTH_FEISHU_BLUE_APP_SECRET = 'feishu-blue-client-secret';
    mockAuthEnv.AUTH_SSO_PROVIDERS = 'feishu,feishu-blue';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers both providers with isolated credentials and callback paths', () => {
    const { genericOAuthProviders } = initBetterAuthSSOProviders();

    expect(genericOAuthProviders).toEqual([
      expect.objectContaining({
        clientId: 'feishu-client-id',
        clientSecret: 'feishu-client-secret',
        providerId: 'feishu',
        redirectURI: 'https://chat.example.com/api/auth/callback/feishu',
      }),
      expect.objectContaining({
        clientId: 'feishu-blue-client-id',
        clientSecret: 'feishu-blue-client-secret',
        providerId: 'feishu-blue',
        redirectURI: 'https://chat.example.com/api/auth/callback/feishu-blue',
      }),
    ]);
  });

  it('keeps the existing provider as the default export', () => {
    expect(Feishu.id).toBe('feishu');
    expect(FeishuBlue.id).toBe('feishu-blue');
  });

  it('fails fast when Feishu Blue credentials are incomplete', () => {
    mockAuthEnv.AUTH_SSO_PROVIDERS = 'feishu-blue';
    mockAuthEnv.AUTH_FEISHU_BLUE_APP_SECRET = undefined;

    expect(() => initBetterAuthSSOProviders()).toThrow(
      '[Better-Auth] feishu-blue SSO provider environment variables are not set correctly!',
    );
  });

  it('uses provider-specific fallback email domains', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            code: 0,
            data: { name: 'Feishu User', union_id: 'union-user' },
          }),
          { status: 200 },
        ),
    );

    const feishuEnv = Feishu.checkEnvs();
    const feishuBlueEnv = FeishuBlue.checkEnvs();
    if (!feishuEnv || !feishuBlueEnv) throw new Error('Feishu test credentials are missing');

    const feishuUser = await Feishu.build(feishuEnv).getUserInfo?.({
      accessToken: 'feishu-token',
    });
    const feishuBlueUser = await FeishuBlue.build(feishuBlueEnv).getUserInfo?.({
      accessToken: 'feishu-blue-token',
    });

    expect(feishuUser?.email).toBe('union-user@feishu.sso');
    expect(feishuUser?.emailVerified).toBe(false);
    expect(feishuBlueUser?.email).toBe('union-user@feishu-blue.sso');
    expect(feishuBlueUser?.emailVerified).toBe(false);
  });

  it('marks an email returned by Feishu as verified', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 0,
          data: {
            email: 'member@cotticoffee.com',
            name: 'Feishu User',
            union_id: 'union-user',
          },
        }),
        { status: 200 },
      ),
    );

    const feishuEnv = Feishu.checkEnvs();
    if (!feishuEnv) throw new Error('Feishu test credentials are missing');

    const user = await Feishu.build(feishuEnv).getUserInfo?.({ accessToken: 'feishu-token' });

    expect(user?.email).toBe('member@cotticoffee.com');
    expect(user?.emailVerified).toBe(true);
  });
});
