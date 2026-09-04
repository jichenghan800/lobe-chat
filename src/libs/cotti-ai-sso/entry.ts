export const COTTI_AI_CHAT_HOST = 'chat.cotti.ai';
export const COTTI_AI_CHAT_ORIGIN = `https://${COTTI_AI_CHAT_HOST}`;
export const COTTI_AI_SSO_ENTRY_PATH = '/auth/cotti-ai-entry';

const hasControlCharacters = (value: string): boolean =>
  [...value].some((character) => {
    const codePoint = character.codePointAt(0) || 0;
    return codePoint <= 31 || codePoint === 127;
  });

/**
 * Keep Cotti AI SSO entry redirects on the current product origin. Besides
 * preventing open redirects, the auth-page exclusions provide a recovery path
 * instead of sending a failed callback straight back into another OIDC loop.
 */
export const normalizeCottiAiReturnTo = (value: string | null | undefined): string => {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    hasControlCharacters(value)
  ) {
    return '/';
  }

  const pathname = value.split(/[?#]/, 1)[0];
  if (
    pathname === COTTI_AI_SSO_ENTRY_PATH ||
    pathname === '/signin' ||
    pathname === '/auth-error'
  ) {
    return '/';
  }

  return value;
};

export const isCottiAiChatHost = (hostname: string): boolean =>
  hostname.toLowerCase() === COTTI_AI_CHAT_HOST;

const parseHostname = (host: string): string => {
  try {
    return new URL(`http://${host}`).hostname;
  } catch {
    return '';
  }
};

/**
 * Next.js standalone rewrites requests through 0.0.0.0 inside the container,
 * so nextUrl.hostname is not the browser-facing host. Nginx replaces
 * X-Forwarded-Host with $host before proxying; use its first hop, then Host.
 */
export const resolveRequestHostname = (headers: Headers, fallbackHostname = ''): string => {
  const forwardedHost = headers.get('x-forwarded-host')?.split(',', 1)[0]?.trim();
  const host = forwardedHost || headers.get('host')?.trim();
  return host ? parseHostname(host) : fallbackHostname;
};

export const buildCottiAiSsoEntryUrl = (returnTo: string): URL => {
  const url = new URL(COTTI_AI_SSO_ENTRY_PATH, COTTI_AI_CHAT_ORIGIN);
  url.searchParams.set('returnTo', normalizeCottiAiReturnTo(returnTo));
  return url;
};
