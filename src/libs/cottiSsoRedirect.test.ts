// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cottiSsoRedirect } from './cottiSsoRedirect';

const handler = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: { handler } }));
const origin = 'https://chat.cotti.ai';
const request = (query = '', host = 'chat.cotti.ai') =>
  new Request(`${origin}/spa-auth/zh-CN/signin${query}`, { headers: { host } });

describe('Cotti server-side SSO entry', () => {
  beforeEach(() => {
    handler.mockReset();
  });

  it('redirects before rendering the SPA and preserves every OAuth state cookie', async () => {
    const headers = new Headers();
    headers.append('Set-Cookie', 'state=one; Path=/; HttpOnly; Secure');
    headers.append('Set-Cookie', 'verifier=two; Path=/; HttpOnly; Secure');
    handler.mockResolvedValue(
      Response.json({ url: 'https://auth.cotti.ai/oauth2/authorize?state=test' }, { headers }),
    );
    const response = await cottiSsoRedirect(
      request('?callbackUrl=https://evil.example'),
      '/signin',
      origin,
    );
    expect(response?.status).toBe(302);
    expect(response?.headers.get('location')).toBe(
      'https://auth.cotti.ai/oauth2/authorize?state=test',
    );
    expect(response?.headers.getSetCookie()).toHaveLength(2);
    expect(response?.headers.get('cache-control')).toContain('no-store');
    const posted = handler.mock.calls[0][0] as Request;
    expect(await posted.json()).toEqual({
      providerId: 'generic-oidc',
      callbackURL: `${origin}/`,
      newUserCallbackURL: `${origin}/onboarding`,
    });
  });

  it('supports the Docker self-rewrite while retaining the original trusted host', async () => {
    handler.mockResolvedValue(Response.json({ url: 'https://auth.cotti.ai/oauth2/authorize' }));
    const req = request('', '127.0.0.1:3210');
    req.headers.set('x-forwarded-host', 'chat.cotti.ai');
    expect((await cottiSsoRedirect(req, '/signin', origin))?.status).toBe(302);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it.each(['?reason=signedOut', '?error=invalid_code', '?error='])(
    'keeps recovery/logout interactive: %s',
    async (query) => {
      expect(await cottiSsoRedirect(request(query), '/signin', origin)).toBeNull();
      expect(handler).not.toHaveBeenCalled();
    },
  );

  it('leaves legacy hosts and other auth routes unchanged', async () => {
    expect(
      await cottiSsoRedirect(request('', 'chatdev.cotticoffee.com'), '/signin', origin),
    ).toBeNull();
    expect(await cottiSsoRedirect(request(), '/signup', origin)).toBeNull();
    expect(
      await cottiSsoRedirect(request(), '/signin', 'https://chatdev.cotticoffee.com'),
    ).toBeNull();
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not create OAuth state on prefetch', async () => {
    const req = request();
    req.headers.set('purpose', 'prefetch');
    expect(await cottiSsoRedirect(req, '/signin', origin)).toBeNull();
    expect(handler).not.toHaveBeenCalled();
  });

  it.each(['failure', 'unexpected-origin'])(
    'returns a recoverable page without a redirect loop on %s',
    async (failure) => {
      if (failure === 'failure') handler.mockRejectedValue(new Error('Unavailable'));
      else handler.mockResolvedValue(Response.json({ url: 'https://evil.example/' }));
      const response = await cottiSsoRedirect(request(), '/signin', origin);
      expect(response?.headers.get('location')).toBe(`${origin}/signin?error=sso_unavailable`);
      expect(
        await cottiSsoRedirect(request('?error=sso_unavailable'), '/signin', origin),
      ).toBeNull();
      expect(handler).toHaveBeenCalledTimes(1);
    },
  );
});
