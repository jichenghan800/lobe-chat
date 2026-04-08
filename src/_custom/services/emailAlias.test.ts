import { describe, expect, it } from 'vitest';

import {
  areEmailsEquivalent,
  normalizeEmailDomainAlias,
  normalizeEmailIdentity,
  normalizeEmailInput,
} from './emailAlias';

describe('emailAlias', () => {
  it('should normalize input casing and whitespace', () => {
    expect(normalizeEmailInput('  User.Name@CottiCoffee.com ')).toBe('user.name@cotticoffee.com');
  });

  it('should map equivalent enterprise domains to the same identity', () => {
    expect(normalizeEmailIdentity('user@abite.com')).toBe('user@abite.com');
    expect(normalizeEmailIdentity('user@cotticoffee.com')).toBe('user@abite.com');
  });

  it('should keep unrelated domains unchanged', () => {
    expect(normalizeEmailIdentity('user@example.com')).toBe('user@example.com');
    expect(normalizeEmailDomainAlias('example.com')).toBe('example.com');
  });

  it('should treat equivalent enterprise emails as the same user', () => {
    expect(areEmailsEquivalent('User.Name@abite.com', 'user.name@cotticoffee.com')).toBe(true);
    expect(areEmailsEquivalent('user@abite.com', 'other@cotticoffee.com')).toBe(false);
  });

  it('should keep malformed emails stable for upstream validation', () => {
    expect(normalizeEmailIdentity('invalid-email')).toBe('invalid-email');
    expect(normalizeEmailIdentity('user@middle@example.com')).toBe('user@middle@example.com');
  });
});
