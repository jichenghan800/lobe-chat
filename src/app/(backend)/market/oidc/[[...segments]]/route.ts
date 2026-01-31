import { type NextRequest, NextResponse } from 'next/server';

import { getTrustedClientTokenForSession } from '@/libs/trusted-client';
import { MarketService } from '@/server/services/market';

const MARKET_BASE_URL = process.env.NEXT_PUBLIC_MARKET_BASE_URL || 'https://market.lobehub.com';
const MARKET_TOKEN_ENDPOINT = `${MARKET_BASE_URL}/token`;

type RouteContext = {
  params: Promise<{
    segments?: string[];
  }>;
};
const ALLOWED_ENDPOINTS = new Set(['handoff', 'token', 'userinfo']);

const ensureEndpoint = (segments?: string[]) => {
  if (!segments || segments.length === 0) {
    return { error: 'missing_endpoint', status: 404 } as const;
  }

  if (segments.length !== 1) {
    return { error: 'unsupported_nested_path', status: 404 } as const;
  }

  const endpoint = segments[0];

  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    return { error: 'unknown_endpoint', status: 404 } as const;
  }

  return { endpoint } as const;
};

const methodNotAllowed = (allowed: string[]) =>
  NextResponse.json(
    {
      error: 'method_not_allowed',
      message: `Allowed methods: ${allowed.join(', ')}`,
      status: 'error',
    },
    {
      headers: { Allow: allowed.join(', ') },
      status: 405,
    },
  );

const extractProxyError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return { message: String(error) };
  }

  const maybeError = error as {
    body?: unknown;
    data?: unknown;
    message?: string;
    response?: { body?: unknown; data?: unknown; status?: number; statusText?: string };
    status?: number;
    statusCode?: number;
    statusText?: string;
  };

  const status = maybeError.status ?? maybeError.statusCode ?? maybeError.response?.status;
  const statusText = maybeError.statusText ?? maybeError.response?.statusText;
  const body =
    maybeError.body ?? maybeError.data ?? maybeError.response?.body ?? maybeError.response?.data;

  return {
    body,
    message: maybeError.message,
    status,
    statusText,
  };
};

const handleProxy = async (req: NextRequest, context: RouteContext) => {
  const marketService = new MarketService();
  const market = marketService.market;

  const { segments } = await context.params;
  const endpointResult = ensureEndpoint(segments);

  if ('error' in endpointResult) {
    return NextResponse.json(
      {
        error: endpointResult.error,
        message: 'Requested endpoint is not available.',
        status: 'error',
      },
      { status: endpointResult.status },
    );
  }

  const endpoint = endpointResult.endpoint;

  switch (endpoint) {
    case 'handoff': {
      try {
        const id = req.nextUrl.searchParams.get('id');
        if (id) {
          const handoff = await market.auth.getOAuthHandoff(id);
          return new NextResponse(JSON.stringify(handoff), { status: 200 });
        } else {
          return NextResponse.json(
            {
              error: 'missing_id',
              message: 'ID is required for handoff proxy.',
              status: 'error',
            },
            { status: 400 },
          );
        }
      } catch (error) {
        return NextResponse.json(
          {
            error: 'handoff_proxy_failed',
            message: error instanceof Error ? error.message : 'Unknown error',
            status: 'error',
          },
          { status: 500 },
        );
      }
    }

    case 'token': {
      if (req.method !== 'POST') {
        return methodNotAllowed(['POST']);
      }

      try {
        const body = await req.text();
        const form = new URLSearchParams(body);

        const grantType = (form.get('grant_type') || 'authorization_code') as
          | 'authorization_code'
          | 'refresh_token';

        if (grantType === 'authorization_code') {
          const clientId = form.get('client_id');
          const code = form.get('code');
          const codeVerifier = form.get('code_verifier');
          const redirectUri = form.get('redirect_uri');

          const response = await fetch(MARKET_TOKEN_ENDPOINT, {
            body: new URLSearchParams({
              client_id: clientId || '',
              code: code || '',
              code_verifier: codeVerifier || '',
              grant_type: 'authorization_code',
              redirect_uri: redirectUri || '',
            }).toString(),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST',
          });

          const raw = await response.text();
          try {
            const json = JSON.parse(raw) as Record<string, unknown>;
            if (!response.ok) {
              return NextResponse.json(
                {
                  detail: { body: json, status: response.status, statusText: response.statusText },
                  error: 'token_exchange_failed',
                  message: json?.error_description || json?.error || 'Token exchange failed',
                  status: 'error',
                },
                { status: response.status },
              );
            }
            return NextResponse.json(json);
          } catch {
            return NextResponse.json(
              {
                detail: { body: raw, status: response.status, statusText: response.statusText },
                error: 'invalid_token_response',
                message: 'Invalid token response payload',
                status: 'error',
              },
              { status: 500 },
            );
          }
        }

        if (grantType === 'refresh_token') {
          const refreshToken = form.get('refresh_token');
          const clientId = form.get('client_id');
          const response = await fetch(MARKET_TOKEN_ENDPOINT, {
            body: new URLSearchParams({
              client_id: clientId || '',
              grant_type: 'refresh_token',
              refresh_token: refreshToken || '',
            }).toString(),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST',
          });

          const raw = await response.text();
          try {
            const json = JSON.parse(raw) as Record<string, unknown>;
            if (!response.ok) {
              return NextResponse.json(
                {
                  detail: { body: json, status: response.status, statusText: response.statusText },
                  error: 'token_refresh_failed',
                  message: json?.error_description || json?.error || 'Token refresh failed',
                  status: 'error',
                },
                { status: response.status },
              );
            }
            return NextResponse.json(json);
          } catch {
            return NextResponse.json(
              {
                detail: { body: raw, status: response.status, statusText: response.statusText },
                error: 'invalid_token_response',
                message: 'Invalid token response payload',
                status: 'error',
              },
              { status: 500 },
            );
          }
        }

        return NextResponse.json(
          {
            error: 'unsupported_grant_type',
            message: `Unsupported grant_type: ${grantType}`,
            status: 'error',
          },
          { status: 400 },
        );
      } catch (error) {
        const detail = extractProxyError(error);
        console.error('[MarketOIDC] Failed to proxy token request:', detail);
        return NextResponse.json(
          {
            detail,
            error: 'token_proxy_failed',
            message: error instanceof Error ? error.message : 'Unknown error',
            status: 'error',
          },
          { status: 500 },
        );
      }
    }

    case 'userinfo': {
      if (req.method !== 'POST') {
        return methodNotAllowed(['POST']);
      }

      try {
        const { token } = (await req.json()) as { token?: string };

        // 如果没有 token，尝试使用 trustedClientToken
        if (!token) {
          const trustedClientToken = await getTrustedClientTokenForSession();

          if (!trustedClientToken) {
            return NextResponse.json(
              {
                error: 'missing_token',
                message: 'Token is required for userinfo proxy.',
                status: 'error',
              },
              { status: 400 },
            );
          }

          // 使用 trustedClientToken 直接调用 Market userinfo 端点
          const userInfoUrl = `${MARKET_BASE_URL}/lobehub-oidc/userinfo`;
          const response = await fetch(userInfoUrl, {
            headers: {
              'Content-Type': 'application/json',
              'x-lobe-trust-token': trustedClientToken,
            },
            method: 'GET',
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch user info: ${response.status} ${response.statusText}`);
          }

          const userInfo = await response.json();
          return NextResponse.json(userInfo);
        }

        const response = await market.auth.getUserInfo(token);
        return NextResponse.json(response);
      } catch (error) {
        console.error('[MarketOIDC] Failed to proxy userinfo request:', error);
        return NextResponse.json(
          {
            error: 'userinfo_proxy_failed',
            message: error instanceof Error ? error.message : 'Unknown error',
            status: 'error',
          },
          { status: 500 },
        );
      }
    }

    default: {
      return NextResponse.json(
        {
          error: 'unsupported_endpoint',
          message: 'Requested endpoint is not supported.',
          status: 'error',
        },
        { status: 404 },
      );
    }
  }
};

export const GET = (req: NextRequest, context: RouteContext) => handleProxy(req, context);
export const POST = (req: NextRequest, context: RouteContext) => handleProxy(req, context);

export const dynamic = 'force-dynamic';
