import { APIError } from 'better-auth/api';
import { constantTimeEqual } from 'better-auth/crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { auth } from '@/auth';

const DEV_BYPASS_ENABLED = process.env.DEV_AUTH_BYPASS_ENABLED === '1';
const DEV_BYPASS_SECRET = process.env.DEV_AUTH_BYPASS_SECRET || '';
const DEV_BYPASS_EMAIL = process.env.DEV_AUTH_BYPASS_EMAIL || 'dev@local.test';
const DEV_BYPASS_NAME = process.env.DEV_AUTH_BYPASS_NAME || 'Dev User';
const DEV_BYPASS_PASSWORD = process.env.DEV_AUTH_BYPASS_PASSWORD || DEV_BYPASS_SECRET;
const DEV_BYPASS_ALLOW_PROD = process.env.DEV_AUTH_BYPASS_ALLOW_PROD === '1';
const DEV_BYPASS_ALLOW_QUERY_TOKEN = process.env.DEV_AUTH_BYPASS_ALLOW_QUERY_TOKEN === '1';

const isEnabled = () => {
  if (!DEV_BYPASS_ENABLED) return false;
  if (!DEV_BYPASS_SECRET) return false;
  if (!DEV_BYPASS_PASSWORD) return false;
  if (process.env.NODE_ENV === 'production' && !DEV_BYPASS_ALLOW_PROD) return false;
  return true;
};

const readToken = (req: NextRequest) => {
  const tokenFromHeader = req.headers.get('x-dev-auth-token') || '';

  // Default deny for query token to avoid accidental leak via URL logs/history.
  if (tokenFromHeader) return tokenFromHeader;
  if (!DEV_BYPASS_ALLOW_QUERY_TOKEN) return '';

  return req.nextUrl.searchParams.get('token') || '';
};

const forbid = (status: number, message: string) => {
  return NextResponse.json({ error: message }, { status });
};

const copySetCookie = (response: NextResponse, headers: Headers | null | undefined) => {
  if (!headers) return;
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof getSetCookie === 'function') {
    for (const cookie of getSetCookie.call(headers)) {
      response.headers.append('set-cookie', cookie);
    }
    return;
  }
  const fallback = headers.get('set-cookie');
  if (fallback) response.headers.append('set-cookie', fallback);
};

const ensureDevUser = async (email: string, password: string) => {
  const ctx = await auth.$context;
  const existing = await ctx.internalAdapter.findUserByEmail(email, { includeAccounts: true });
  let user = existing?.user;

  if (!user) {
    user = await ctx.internalAdapter.createUser({
      email,
      emailVerified: true,
      name: DEV_BYPASS_NAME,
    });
  } else if (!user.emailVerified) {
    await ctx.internalAdapter.updateUser(user.id, { emailVerified: true });
  }

  const hasCredential = !!existing?.accounts?.some(
    (account) => account.providerId === 'credential',
  );
  if (!hasCredential) {
    const hash = await ctx.password.hash(password);
    await ctx.internalAdapter.linkAccount({
      accountId: user.id,
      password: hash,
      providerId: 'credential',
      userId: user.id,
    });
  }

  return user;
};

const handleDevLogin = async (req: NextRequest) => {
  if (!isEnabled()) return forbid(404, 'Not Found');

  const token = readToken(req);
  if (!token || !constantTimeEqual(token, DEV_BYPASS_SECRET)) {
    return forbid(403, 'Forbidden');
  }

  try {
    await ensureDevUser(DEV_BYPASS_EMAIL, DEV_BYPASS_PASSWORD);

    const result = await auth.api.signInEmail({
      body: {
        email: DEV_BYPASS_EMAIL,
        password: DEV_BYPASS_PASSWORD,
        rememberMe: true,
      },
      headers: req.headers,
      returnHeaders: true,
      returnStatus: true,
    });

    const redirectUrl = new URL('/', req.nextUrl.origin);
    const response = NextResponse.redirect(redirectUrl);
    copySetCookie(response, result.headers);

    return response;
  } catch (error) {
    if (error instanceof APIError) {
      return forbid(error.statusCode ?? 500, error.message || 'Auth error');
    }

    return forbid(500, 'Dev login failed');
  }
};

export const GET = handleDevLogin;
export const POST = handleDevLogin;
