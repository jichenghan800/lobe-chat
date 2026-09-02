import { describe, expect, it } from 'vitest';

import { COTTI_OIDC_CLIENT_IDS, isCottiOidcClient } from './cottiClients';

describe('COTTI OIDC clients', () => {
  it('recognizes only the COTTI unified-login clients', () => {
    expect(COTTI_OIDC_CLIENT_IDS).toEqual([
      'cotticoffee-nano',
      'cotticoffee-ppt',
      'cotticoffee-comfyui',
    ]);
    expect(isCottiOidcClient('cotticoffee-nano')).toBe(true);
    expect(isCottiOidcClient('cotticoffee-ppt')).toBe(true);
    expect(isCottiOidcClient('cotticoffee-comfyui')).toBe(true);
    expect(isCottiOidcClient('lobehub-desktop')).toBe(false);
    expect(isCottiOidcClient('lobehub-market')).toBe(false);
  });
});
