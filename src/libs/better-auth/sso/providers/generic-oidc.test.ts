import { describe, expect, it, vi } from 'vitest';

vi.mock('@/envs/auth', () => ({
  authEnv: {
    AUTH_GENERIC_OIDC_ID: 'cotti-chat',
    AUTH_GENERIC_OIDC_ISSUER: 'https://auth.cotti.ai/api/auth',
    AUTH_GENERIC_OIDC_SECRET: 'cotti-chat-client-secret',
  },
}));

describe('Generic OIDC SSO provider', () => {
  it('uses client_secret_basic for the Cotti AI token exchange', async () => {
    const { default: provider } = await import('./generic-oidc');
    const env = provider.checkEnvs();

    expect(env).toEqual({
      AUTH_GENERIC_OIDC_ID: 'cotti-chat',
      AUTH_GENERIC_OIDC_ISSUER: 'https://auth.cotti.ai/api/auth',
      AUTH_GENERIC_OIDC_SECRET: 'cotti-chat-client-secret',
    });
    expect(env && provider.build(env)).toEqual(
      expect.objectContaining({
        authentication: 'basic',
        providerId: 'generic-oidc',
      }),
    );
  });
});
