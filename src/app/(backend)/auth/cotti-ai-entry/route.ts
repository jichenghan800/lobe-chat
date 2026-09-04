import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import {
  COTTI_AI_CHAT_ORIGIN,
  isCottiAiChatHost,
  normalizeCottiAiReturnTo,
  resolveRequestHostname,
} from '@/libs/cotti-ai-sso/entry';

const startCottiAiOAuth = async (request: NextRequest, returnTo: string): Promise<Response> => {
  const authResponse = await auth.api.signInWithOAuth2({
    asResponse: true,
    body: {
      callbackURL: returnTo,
      errorCallbackURL: '/auth-error',
      providerId: 'generic-oidc',
    },
    headers: request.headers,
  });

  if (!authResponse.ok) return authResponse;

  const payload = (await authResponse.clone().json()) as { url?: string };
  if (!payload.url) {
    return NextResponse.json(
      { error: 'Cotti AI SSO authorization URL is missing' },
      { status: 502 },
    );
  }

  // Better Auth writes the signed OAuth state/PKCE cookie on its JSON response.
  // Preserve those headers while turning the server API result into a browser 302.
  const headers = new Headers(authResponse.headers);
  headers.delete('content-length');
  headers.delete('content-type');
  headers.set('location', payload.url);

  return new Response(null, { headers, status: 302 });
};

export async function GET(request: NextRequest) {
  const requestHostname = resolveRequestHostname(request.headers, request.nextUrl.hostname);
  if (!isCottiAiChatHost(requestHostname)) {
    return NextResponse.redirect(new URL('/signin', request.nextUrl.origin), 302);
  }

  const returnTo = normalizeCottiAiReturnTo(request.nextUrl.searchParams.get('returnTo'));
  const session = await auth.api.getSession({ headers: request.headers });

  if (session?.user) {
    return NextResponse.redirect(new URL(returnTo, COTTI_AI_CHAT_ORIGIN), 302);
  }

  return startCottiAiOAuth(request, returnTo);
}
