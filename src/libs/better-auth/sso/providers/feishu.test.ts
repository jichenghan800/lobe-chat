import { describe, expect, it, vi } from 'vitest';

vi.mock('@/envs/auth', () => ({
  authEnv: {
    AUTH_FEISHU_APP_ID: 'feishu-client-id',
    AUTH_FEISHU_APP_SECRET: 'feishu-client-secret',
    AUTH_FEISHU_BLUE_APP_ID: 'feishu-blue-client-id',
    AUTH_FEISHU_BLUE_APP_SECRET: 'feishu-blue-client-secret',
  },
}));

describe('Feishu SSO providers', () => {
  it('should build the default Feishu provider from default credentials', async () => {
    const { default: provider } = await import('./feishu');

    const env = provider.checkEnvs();

    expect(env).toEqual({
      appId: 'feishu-client-id',
      appSecret: 'feishu-client-secret',
    });
    expect(env && provider.build(env)).toEqual(
      expect.objectContaining({
        clientId: 'feishu-client-id',
        clientSecret: 'feishu-client-secret',
        providerId: 'feishu',
      }),
    );
  });

  it('should build the Blue Feishu provider from blue credentials', async () => {
    const { default: provider } = await import('./feishu-blue');

    const env = provider.checkEnvs();

    expect(env).toEqual({
      appId: 'feishu-blue-client-id',
      appSecret: 'feishu-blue-client-secret',
    });
    expect(env && provider.build(env)).toEqual(
      expect.objectContaining({
        clientId: 'feishu-blue-client-id',
        clientSecret: 'feishu-blue-client-secret',
        providerId: 'feishu-blue',
      }),
    );
  });
});
