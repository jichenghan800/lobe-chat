const CHAT_ORIGIN = 'https://chat.cotti.ai';

/** Start OAuth before downloading the auth SPA. Keep recovery and logout interactive. */
export async function cottiSsoRedirect(request: Request, pathname: string, appUrl: string) {
  const url = new URL(request.url);
  if (
    appUrl.replace(/\/$/, '') !== CHAT_ORIGIN ||
    (request.headers.get('host') !== 'chat.cotti.ai' &&
      request.headers.get('x-forwarded-host') !== 'chat.cotti.ai') ||
    !['/signin', '/signin/'].includes(pathname) ||
    url.searchParams.get('reason') === 'signedOut' ||
    url.searchParams.has('error') ||
    request.headers.has('next-router-prefetch') ||
    request.headers.get('purpose') === 'prefetch'
  )
    return null;

  const headers = new Headers({
    'Cache-Control': 'private, no-store',
    'Referrer-Policy': 'no-referrer',
  });
  try {
    const { auth } = await import('@/auth');
    const response = await auth.handler(
      new Request(`${CHAT_ORIGIN}/api/auth/sign-in/oauth2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cookie': request.headers.get('cookie') || '',
          'origin': CHAT_ORIGIN,
          ...(request.headers.get('x-forwarded-for') && {
            'x-forwarded-for': request.headers.get('x-forwarded-for')!,
          }),
        },
        body: JSON.stringify({
          providerId: 'generic-oidc',
          callbackURL: `${CHAT_ORIGIN}/`,
          newUserCallbackURL: `${CHAT_ORIGIN}/onboarding`,
        }),
      }),
    );
    if (!response.ok) throw new Error('OAuth initiation failed');
    const data = await response.json();
    const target = new URL(data.url);
    if (target.origin !== 'https://auth.cotti.ai') throw new Error('Unexpected OAuth origin');
    for (const cookie of response.headers.getSetCookie()) headers.append('Set-Cookie', cookie);
    headers.set('Location', target.href);
  } catch {
    // An explicit error suppresses both server and client auto-start: no redirect loop.
    headers.set('Location', `${CHAT_ORIGIN}/signin?error=sso_unavailable`);
  }
  return new Response(null, { status: 302, headers });
}
