// @vitest-environment node
import { memoryAdapter } from 'better-auth/adapters/memory';
import { betterAuth } from 'better-auth/minimal';
import { genericOAuth } from 'better-auth/plugins';
import { afterEach, expect, it, vi } from 'vitest';

import { emailWhitelist } from './email-whitelist';

vi.mock('@/envs/auth', () => ({ authEnv: { AUTH_ALLOWED_EMAILS: 'cotticoffee.com' } }));
afterEach(() => vi.unstubAllEnvs());

it.each(['oauth2/callback', 'callback'])(
  'creates a Portal member through %s, while rejecting invalid state',
  async (callbackPath) => {
    vi.stubEnv('COTTI_PORTAL_MANAGED_ACCESS', '1');
    vi.stubEnv('APP_URL', 'https://chat.cotti.ai');
    vi.stubEnv('AUTH_GENERIC_OIDC_ID', 'cotti-chat');
    vi.stubEnv(
      'AUTH_GENERIC_OIDC_ISSUER',
      'http://cotti-portal:3700/api/auth/.well-known/openid-configuration',
    );
    const database = { user: [], session: [], account: [], verification: [] };
    const getUserInfo = vi.fn().mockResolvedValue({
      email: 'portal-member@example.com',
      emailVerified: true,
      id: 'portal-test',
      name: 'Portal test',
    });
    const auth = betterAuth({
      baseURL: 'http://localhost:3000',
      secret: 'test-only-secret-not-used-outside-isolated-memory',
      database: memoryAdapter(database),
      plugins: [
        emailWhitelist({ isAllowed: () => false }),
        genericOAuth({
          config: [
            {
              providerId: 'generic-oidc',
              clientId: 'cotti-chat',
              clientSecret: 'test-only',
              authorizationUrl: 'http://provider.local/authorize',
              tokenUrl: 'http://provider.local/token',
              getToken: async () => ({ accessToken: 'test-token', scopes: ['openid', 'email'] }),
              getUserInfo,
            },
          ],
        }),
      ],
    });
    const start = await auth.handler(
      new Request('http://localhost:3000/api/auth/sign-in/oauth2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:3000' },
        body: JSON.stringify({
          providerId: 'generic-oidc',
          callbackURL: 'http://localhost:3000/done',
        }),
      }),
    );
    expect(start.status).toBe(200);
    const { url } = await start.json();
    const state = new URL(url).searchParams.get('state');
    expect(state).toBeTruthy();
    const cookie = start.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ');
    const invalid = await auth.handler(
      new Request(
        `http://localhost:3000/api/auth/${callbackPath}/generic-oidc?code=test&state=invalid`,
        { headers: { cookie } },
      ),
    );
    expect(invalid.headers.get('location')).not.toBe('http://localhost:3000/done');
    expect(getUserInfo).not.toHaveBeenCalled();
    const result = await auth.handler(
      new Request(
        `http://localhost:3000/api/auth/${callbackPath}/generic-oidc?code=test&state=${state}`,
        { headers: { cookie } },
      ),
    );
    expect(result.status).toBe(302);
    expect(result.headers.get('location')).toBe('http://localhost:3000/done');
    expect(database.user).toHaveLength(1);
    expect(database.account).toHaveLength(1);
    expect(database.session).toHaveLength(1);
  },
);
