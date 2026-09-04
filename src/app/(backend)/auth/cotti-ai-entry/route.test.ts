/**
 * @vitest-environment node
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

const { getSession, signInWithOAuth2 } = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInWithOAuth2: vi.fn(),
}));

vi.mock('@/auth', () => ({
  auth: { api: { getSession, signInWithOAuth2 } },
}));

describe('GET /auth/cotti-ai-entry', () => {
  beforeEach(() => {
    getSession.mockReset();
    signInWithOAuth2.mockReset();
  });

  it('redirects an existing product session without starting a new OAuth flow', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } });

    const response = await GET(
      new NextRequest('https://chat.cotti.ai/auth/cotti-ai-entry?returnTo=%2Fsettings'),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://chat.cotti.ai/settings');
    expect(signInWithOAuth2).not.toHaveBeenCalled();
  });

  it('starts OAuth server-side and preserves the signed state cookie', async () => {
    getSession.mockResolvedValue(null);
    signInWithOAuth2.mockResolvedValue(
      Response.json(
        { redirect: true, url: 'https://auth.cotti.ai/api/auth/oauth2/authorize?state=state-1' },
        { headers: { 'set-cookie': 'better-auth.state=signed; Path=/; HttpOnly; Secure' } },
      ),
    );

    const request = new NextRequest(
      'https://chat.cotti.ai/auth/cotti-ai-entry?returnTo=%2Fagent%2F123%3Fq%3Dhello',
    );
    const response = await GET(request);

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toContain('https://auth.cotti.ai/');
    expect(response.headers.get('set-cookie')).toContain('better-auth.state=signed');
    expect(signInWithOAuth2).toHaveBeenCalledWith({
      asResponse: true,
      body: {
        callbackURL: '/agent/123?q=hello',
        errorCallbackURL: '/auth-error',
        providerId: 'generic-oidc',
      },
      headers: request.headers,
    });
  });

  it('does not enable Cotti AI entry behavior on the legacy host', async () => {
    const response = await GET(
      new NextRequest('https://chatdev.cotticoffee.com/auth/cotti-ai-entry'),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://chatdev.cotticoffee.com/signin');
    expect(getSession).not.toHaveBeenCalled();
    expect(signInWithOAuth2).not.toHaveBeenCalled();
  });
});
