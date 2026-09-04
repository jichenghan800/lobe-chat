/**
 * @vitest-environment node
 */
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { defineConfig } from './define-config';

const { getSession } = vi.hoisted(() => ({
  getSession: vi.fn().mockResolvedValue({ user: { id: 'user-1' } }),
}));

vi.mock('@/auth', () => ({
  auth: { api: { getSession } },
}));

const { middleware } = defineConfig();

const run = async (url: string) => {
  const res = await middleware(new NextRequest(url));
  return res?.headers.get('x-middleware-rewrite');
};

const runResponse = async (url: string) => middleware(new NextRequest(url));

describe('defineConfig locale path-traversal hardening', () => {
  it('rewrites a normal locale into /spa-auth/<locale>', async () => {
    const rewrite = await run('http://localhost:3010/signin?hl=ja-JP');
    expect(new URL(rewrite!).pathname).toBe('/spa-auth/ja-JP/signin');
  });

  it('falls back to en-US for a traversal locale (plain)', async () => {
    const rewrite = await run('http://localhost:3010/signin?hl=../../api/dev/x');
    const { pathname } = new URL(rewrite!);
    expect(pathname.startsWith('/spa-auth/')).toBe(true);
    expect(pathname).toBe('/spa-auth/en-US/signin');
  });

  it('falls back to en-US for a traversal locale (percent-encoded)', async () => {
    const rewrite = await run('http://localhost:3010/signin?hl=..%2F..%2Fapi%2Fdev%2Fx');
    const { pathname } = new URL(rewrite!);
    expect(pathname.startsWith('/spa-auth/')).toBe(true);
    expect(pathname).toBe('/spa-auth/en-US/signin');
  });

  it('does not treat workspace slugs beginning with an auth route as auth SPA pages', async () => {
    const rewrite = await run(
      'http://localhost:3010/oauth-preview-e2e-20260716/settings/oauth-apps?hl=en-US',
    );
    expect(new URL(rewrite!).pathname).toMatch(
      /^\/spa\/[^/]+\/oauth-preview-e2e-20260716\/settings\/oauth-apps$/,
    );
  });
});

describe('defineConfig OIDC protocol routes', () => {
  it.each([
    '/oidc/.well-known/openid-configuration',
    '/oidc/jwks',
    '/oidc/me',
    '/oidc/token',
    '/oidc/token/introspection',
    '/oidc/token/revocation',
    '/oidc/session/end',
  ])('keeps %s public for OIDC clients', async (pathname) => {
    getSession.mockClear();

    const rewrite = await run(`http://localhost:3010${pathname}`);

    expect(rewrite).toBeNull();
    expect(getSession).not.toHaveBeenCalled();
  });
});

describe('defineConfig Cotti AI direct SSO entry', () => {
  it('sends an anonymous protected request directly to the server-side entry', async () => {
    getSession.mockResolvedValueOnce(null);

    const response = await runResponse('https://chat.cotti.ai/settings?tab=profile');
    const location = new URL(response!.headers.get('location')!);

    expect(location.origin).toBe('https://chat.cotti.ai');
    expect(location.pathname).toBe('/auth/cotti-ai-entry');
    expect(location.searchParams.get('returnTo')).toBe('/settings?tab=profile');
  });
});
