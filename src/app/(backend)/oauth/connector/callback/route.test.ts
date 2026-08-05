import { beforeEach, describe, expect, it, vi } from 'vitest';

import { exchangeFeishuAuthorizationCode } from '@/server/services/connector/feishuOAuth';

import { GET } from './route';

const { mockConsume, mockFindById, mockSync, mockUpdate } = vi.hoisted(() => ({
  mockConsume: vi.fn(),
  mockFindById: vi.fn(),
  mockSync: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('@/database/server', () => ({ serverDB: {} }));
vi.mock('@/envs/app', () => ({ appEnv: { APP_URL: 'https://app.example.com' } }));
vi.mock('@/envs/auth', () => ({
  authEnv: { AUTH_FEISHU_APP_ID: 'cli_app', AUTH_FEISHU_APP_SECRET: 'app-secret' },
}));
vi.mock('@/server/modules/KeyVaultsEncrypt', () => ({
  KeyVaultsGateKeeper: { initWithEnvKey: vi.fn().mockResolvedValue({}) },
}));
vi.mock('@modelcontextprotocol/sdk/client/auth.js', () => ({
  discoverAuthorizationServerMetadata: vi
    .fn()
    .mockResolvedValue({ token_endpoint: 'https://as/token' }),
}));
vi.mock('@/server/services/connector/oauth', () => ({
  exchangeConnectorCode: vi.fn().mockResolvedValue({ access_token: 'tok' }),
}));
vi.mock('@/server/services/connector/feishuOAuth', () => ({
  exchangeFeishuAuthorizationCode: vi.fn().mockResolvedValue({
    access_token: 'feishu-uat',
    refresh_token: 'feishu-refresh',
  }),
}));
vi.mock('@/server/services/connector/tokens', () => ({
  tokensToCredentials: vi.fn((tokens: { access_token: string }) => ({
    credentials: { accessToken: tokens.access_token, type: 'oauth2' },
    tokenExpiresAt: null,
  })),
}));
vi.mock('@/server/services/connector/stateStore', () => ({
  consumeConnectorOAuthState: mockConsume,
}));
vi.mock('@/database/models/connector', () => ({
  ConnectorModel: vi
    .fn()
    .mockImplementation(() => ({ findById: mockFindById, update: mockUpdate })),
}));
vi.mock('@/database/models/connectorTool', () => ({
  ConnectorToolModel: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('@/server/services/connector/sync', () => ({ syncConnectorToolsById: mockSync }));

const makeReq = () =>
  ({ nextUrl: { searchParams: new URLSearchParams('code=abc&state=xyz') } }) as any;

beforeEach(() => {
  vi.clearAllMocks();
  mockConsume.mockResolvedValue({
    authorizationServerUrl: 'https://as',
    codeVerifier: 'v',
    connectorId: 'c1',
    lobeUserId: 'u1',
  });
  mockFindById.mockResolvedValue({
    id: 'c1',
    mcpServerUrl: 'https://mcp.example.com',
    oidcConfig: {
      clientId: 'cid',
      redirectUri: 'https://app.example.com/oauth/connector/callback',
    },
  });
  mockUpdate.mockResolvedValue(undefined);
});

describe('connector OAuth callback', () => {
  it('reports synced:false when auth succeeds but tool sync fails', async () => {
    mockSync.mockRejectedValue(new Error('mcp down'));

    const body = await (await GET(makeReq())).text();

    expect(body).toContain('"success":true');
    expect(body).toContain('"synced":false');
  });

  it('reports synced:true when auth and tool sync both succeed', async () => {
    mockSync.mockResolvedValue({ toolCount: 5 });

    const body = await (await GET(makeReq())).text();

    expect(body).toContain('"success":true');
    expect(body).toContain('"synced":true');
  });

  it('uses standard Feishu OAuth and stores the token only on the user connector', async () => {
    mockFindById.mockResolvedValue({
      id: 'c1',
      identifier: 'feishu-documents',
      mcpServerUrl: 'https://mcp.feishu.cn/mcp',
      metadata: { presetId: 'feishu_documents' },
      oidcConfig: {
        clientId: 'cli_app',
        redirectUri: 'https://app.example.com/oauth/connector/callback',
      },
    });
    mockSync.mockResolvedValue({ toolCount: 4 });

    const body = await (await GET(makeReq())).text();

    expect(body).toContain('"success":true');
    expect(exchangeFeishuAuthorizationCode).toHaveBeenCalledWith({
      authorizationCode: 'abc',
      clientId: 'cli_app',
      clientSecret: 'app-secret',
      codeVerifier: 'v',
      redirectUri: 'https://app.example.com/oauth/connector/callback',
    });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ credentials: expect.stringContaining('feishu-uat') }),
    );
  });
});
