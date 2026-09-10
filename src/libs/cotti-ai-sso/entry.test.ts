import { describe, expect, it } from 'vitest';

import {
  buildCottiAiSsoEntryUrl,
  isCottiAiChatHost,
  normalizeCottiAiReturnTo,
  resolveRequestHostname,
} from './entry';

describe('Cotti AI SSO entry helpers', () => {
  it('only enables the direct entry on the dedicated Cotti AI chat host', () => {
    expect(isCottiAiChatHost('chat.cotti.ai')).toBe(true);
    expect(isCottiAiChatHost('CHAT.COTTI.AI')).toBe(true);
    expect(isCottiAiChatHost('chatdev.cotticoffee.com')).toBe(false);
    expect(isCottiAiChatHost('chat.cotti.ai.evil.example')).toBe(false);
  });

  it('keeps local product paths and rejects open redirects', () => {
    expect(normalizeCottiAiReturnTo('/settings?tab=profile')).toBe('/settings?tab=profile');
    expect(normalizeCottiAiReturnTo('https://evil.example')).toBe('/');
    expect(normalizeCottiAiReturnTo('//evil.example')).toBe('/');
    expect(normalizeCottiAiReturnTo('/\\evil.example')).toBe('/');
  });

  it('breaks entry and authentication-page redirect loops', () => {
    expect(normalizeCottiAiReturnTo('/auth/cotti-ai-entry?returnTo=%2F')).toBe('/');
    expect(normalizeCottiAiReturnTo('/signin?error=failed')).toBe('/');
    expect(normalizeCottiAiReturnTo('/auth-error?error=invalid_code')).toBe('/');
  });

  it('builds a same-origin entry URL with an encoded return path', () => {
    const url = buildCottiAiSsoEntryUrl('/agent/123?q=hello');

    expect(url.origin).toBe('https://chat.cotti.ai');
    expect(url.pathname).toBe('/auth/cotti-ai-entry');
    expect(url.searchParams.get('returnTo')).toBe('/agent/123?q=hello');
  });

  it('resolves the browser-facing hostname behind the container proxy', () => {
    expect(
      resolveRequestHostname(
        new Headers({
          'host': '0.0.0.0:3210',
          'x-forwarded-host': 'chat.cotti.ai, internal.proxy',
        }),
      ),
    ).toBe('chat.cotti.ai');
    expect(resolveRequestHostname(new Headers({ host: 'chatdev.cotticoffee.com:443' }))).toBe(
      'chatdev.cotticoffee.com',
    );
  });
});
