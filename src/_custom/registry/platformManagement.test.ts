import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isCottiPlatformAnalyticsEnabled,
  resolveCottiPlatformAnalyticsEnabled,
} from './platformManagement';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('COTTI platform management registry', () => {
  it.each([undefined, '', '  ', '0', ' false ', 'NO', 'off'])('treats %s as disabled', (value) => {
    expect(resolveCottiPlatformAnalyticsEnabled(value)).toBe(false);
  });

  it.each(['1', 'true', 'yes', 'enabled'])('treats %s as enabled', (value) => {
    expect(resolveCottiPlatformAnalyticsEnabled(value)).toBe(true);
  });

  it('reads the public build flag', () => {
    vi.stubEnv('NEXT_PUBLIC_COTTI_SHOW_PLATFORM_ANALYTICS', '1');

    expect(isCottiPlatformAnalyticsEnabled()).toBe(true);
  });
});
