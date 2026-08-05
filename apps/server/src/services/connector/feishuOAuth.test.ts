import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildFeishuAuthorizationUrl,
  exchangeFeishuAuthorizationCode,
  FEISHU_OAUTH_AUTHORIZE_ENDPOINT,
  FEISHU_OAUTH_TOKEN_ENDPOINT,
  refreshFeishuUserAccessToken,
} from './feishuOAuth';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Feishu standard user OAuth', () => {
  it('builds the standard authorization URL with exact read-only scopes and PKCE', async () => {
    const { authorizationUrl, codeVerifier } = await buildFeishuAuthorizationUrl({
      clientId: 'cli_app',
      redirectUri: 'https://app.example.com/oauth/connector/callback',
      scopes: ['search:docs:read', 'offline_access'],
      state: 'state-1',
    });
    const url = new URL(authorizationUrl);

    expect(`${url.origin}${url.pathname}`).toBe(FEISHU_OAUTH_AUTHORIZE_ENDPOINT);
    expect(url.searchParams.get('client_id')).toBe('cli_app');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://app.example.com/oauth/connector/callback',
    );
    expect(url.searchParams.get('scope')).toBe('search:docs:read offline_access');
    expect(url.searchParams.get('state')).toBe('state-1');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toHaveLength(43);
    expect(codeVerifier.length).toBeGreaterThanOrEqual(43);
  });

  it('exchanges the code without using the MCP OAuth endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'uat-a',
          code: 0,
          expires_in: 7200,
          refresh_token: 'refresh-a',
          scope: 'search:docs:read offline_access',
          token_type: 'Bearer',
        }),
        { status: 200 },
      ),
    );

    await expect(
      exchangeFeishuAuthorizationCode({
        authorizationCode: 'code-a',
        clientId: 'cli_app',
        clientSecret: 'secret',
        codeVerifier: 'verifier',
        redirectUri: 'https://app.example.com/oauth/connector/callback',
      }),
    ).resolves.toMatchObject({ access_token: 'uat-a', refresh_token: 'refresh-a' });

    expect(fetchMock).toHaveBeenCalledWith(
      FEISHU_OAUTH_TOKEN_ENDPOINT,
      expect.objectContaining({
        body: JSON.stringify({
          client_id: 'cli_app',
          client_secret: 'secret',
          code: 'code-a',
          code_verifier: 'verifier',
          grant_type: 'authorization_code',
          redirect_uri: 'https://app.example.com/oauth/connector/callback',
        }),
        method: 'POST',
      }),
    );
  });

  it('refreshes a rotating Feishu user token through the v2 token endpoint', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ access_token: 'uat-b', code: 0, refresh_token: 'refresh-b' }),
          { status: 200 },
        ),
      );

    await expect(
      refreshFeishuUserAccessToken({
        clientId: 'cli_app',
        clientSecret: 'secret',
        refreshToken: 'refresh-a',
      }),
    ).resolves.toMatchObject({ access_token: 'uat-b', refresh_token: 'refresh-b' });
    expect(fetchMock).toHaveBeenCalledWith(
      FEISHU_OAUTH_TOKEN_ENDPOINT,
      expect.objectContaining({
        body: JSON.stringify({
          client_id: 'cli_app',
          client_secret: 'secret',
          grant_type: 'refresh_token',
          refresh_token: 'refresh-a',
        }),
      }),
    );
  });
});
