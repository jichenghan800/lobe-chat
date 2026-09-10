import { registerClient } from '@modelcontextprotocol/sdk/client/auth.js';
import type { AuthorizationServerMetadata } from '@modelcontextprotocol/sdk/shared/auth.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { registerDynamicClient, selectDynamicClientAuthMethod } from './oauth';

vi.mock('@modelcontextprotocol/sdk/client/auth.js', () => ({
  discoverAuthorizationServerMetadata: vi.fn(),
  discoverOAuthProtectedResourceMetadata: vi.fn(),
  exchangeAuthorization: vi.fn(),
  extractResourceMetadataUrl: vi.fn(),
  refreshAuthorization: vi.fn(),
  registerClient: vi.fn(),
  startAuthorization: vi.fn(),
}));

vi.mock('@/envs/app', () => ({ appEnv: { APP_URL: 'https://app.example.com' } }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('selectDynamicClientAuthMethod', () => {
  it('uses a public client for Feishu-compatible DCR metadata', () => {
    expect(
      selectDynamicClientAuthMethod({
        authorization_endpoint: 'https://accounts.feishu.cn/oauth/v2/mcp/authorize',
        token_endpoint: 'https://accounts.feishu.cn/oauth/v3/token',
        token_endpoint_auth_methods_supported: ['none'],
      } as AuthorizationServerMetadata),
    ).toBe('none');
  });

  it('keeps client_secret_post for servers that omit auth-method metadata', () => {
    expect(
      selectDynamicClientAuthMethod({
        authorization_endpoint: 'https://auth.example.com/authorize',
        token_endpoint: 'https://auth.example.com/token',
      } as AuthorizationServerMetadata),
    ).toBe('client_secret_post');
  });
});

describe('registerDynamicClient', () => {
  it('registers Feishu as a PKCE public client with only the requested scopes', async () => {
    vi.mocked(registerClient).mockResolvedValue({
      client_id: 'feishu-client',
      redirect_uris: ['https://app.example.com/oauth/connector/callback'],
    });
    const metadata = {
      authorization_endpoint: 'https://accounts.feishu.cn/oauth/v2/mcp/authorize',
      registration_endpoint: 'https://open.feishu.cn/open-apis/app/v1/dcr',
      token_endpoint: 'https://accounts.feishu.cn/oauth/v3/token',
      token_endpoint_auth_methods_supported: ['none'],
    } as AuthorizationServerMetadata;

    await registerDynamicClient({
      authorizationServerUrl: 'https://accounts.feishu.cn/mcp',
      metadata,
      redirectUri: 'https://app.example.com/oauth/connector/callback',
      scopes: ['mcp-tool:docs:fetch-doc', 'offline_access'],
    });

    expect(registerClient).toHaveBeenCalledWith(
      'https://accounts.feishu.cn/mcp',
      expect.objectContaining({
        clientMetadata: expect.objectContaining({
          scope: 'mcp-tool:docs:fetch-doc offline_access',
          token_endpoint_auth_method: 'none',
        }),
        scope: 'mcp-tool:docs:fetch-doc offline_access',
      }),
    );
  });
});
