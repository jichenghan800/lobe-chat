import { describe, expect, it } from 'vitest';

import { MarketAuthError } from '@/layout/AuthProvider/MarketAuth/errors';

import { isMarketAuthorizationDenied } from './errors';

describe('community authorization denial', () => {
  it('recognizes raw and native wrapped denial messages', () => {
    expect(isMarketAuthorizationDenied(new Error('access_denied'))).toBe(true);
    expect(
      isMarketAuthorizationDenied(
        new MarketAuthError('authorizationFailed', { message: 'User denied authorization' }),
      ),
    ).toBe(true);
  });
  it.each([
    'User cancelled authorization',
    'authorization popup was closed',
    'timeout',
    'state mismatch',
  ])('does not turn %s into account recovery', (message) => {
    expect(isMarketAuthorizationDenied(new Error(message))).toBe(false);
  });
});
