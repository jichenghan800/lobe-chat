import { createHash, randomBytes } from 'node:crypto';

import type { OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';

export const FEISHU_OAUTH_AUTHORIZE_ENDPOINT =
  'https://accounts.feishu.cn/open-apis/authen/v1/authorize';
export const FEISHU_OAUTH_ISSUER = 'https://accounts.feishu.cn';
export const FEISHU_OAUTH_TOKEN_ENDPOINT = 'https://open.feishu.cn/open-apis/authen/v2/oauth/token';

interface FeishuTokenResponse {
  access_token?: string;
  code?: number;
  error?: string;
  error_description?: string;
  expires_in?: number;
  msg?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
}

const parseTokenResponse = async (response: Response): Promise<OAuthTokens> => {
  const body = (await response.json()) as FeishuTokenResponse;
  if (!response.ok || (body.code !== undefined && body.code !== 0) || !body.access_token) {
    const reason = body.error_description || body.msg || body.error || `HTTP ${response.status}`;
    throw new Error(`Feishu user authorization failed: ${reason}`);
  }

  return {
    access_token: body.access_token,
    expires_in: body.expires_in,
    refresh_token: body.refresh_token,
    scope: body.scope,
    token_type: body.token_type ?? 'Bearer',
  };
};

export const buildFeishuAuthorizationUrl = async (params: {
  clientId: string;
  redirectUri: string;
  scopes: readonly string[];
  state: string;
}): Promise<{ authorizationUrl: string; codeVerifier: string }> => {
  const codeVerifier = randomBytes(48).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
  const url = new URL(FEISHU_OAUTH_AUTHORIZE_ENDPOINT);

  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('scope', params.scopes.join(' '));
  url.searchParams.set('state', params.state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('prompt', 'consent');

  return { authorizationUrl: url.toString(), codeVerifier };
};

export const exchangeFeishuAuthorizationCode = async (params: {
  authorizationCode: string;
  clientId: string;
  clientSecret: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<OAuthTokens> => {
  const response = await fetch(FEISHU_OAUTH_TOKEN_ENDPOINT, {
    body: JSON.stringify({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      code: params.authorizationCode,
      code_verifier: params.codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: params.redirectUri,
    }),
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    method: 'POST',
  });

  return parseTokenResponse(response);
};

export const refreshFeishuUserAccessToken = async (params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<OAuthTokens> => {
  const response = await fetch(FEISHU_OAUTH_TOKEN_ENDPOINT, {
    body: JSON.stringify({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: params.refreshToken,
    }),
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    method: 'POST',
  });

  return parseTokenResponse(response);
};
