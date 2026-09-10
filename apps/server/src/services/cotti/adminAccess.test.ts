import { describe, expect, it } from 'vitest';

import { parseCottiPlatformAdminEmails, resolveCottiPlatformAdminSource } from './adminAccess';

const ordinaryUser = {
  email: 'member@example.com',
  normalizedEmail: 'member@example.com',
  role: null,
};

describe('COTTI platform admin access policy', () => {
  describe('parseCottiPlatformAdminEmails', () => {
    it('normalizes comma, semicolon, and newline separated addresses', () => {
      const result = parseCottiPlatformAdminEmails(
        ' Admin@Example.com;owner@example.com\n second@example.com,admin@example.com ',
      );

      expect([...result]).toEqual(['admin@example.com', 'owner@example.com', 'second@example.com']);
    });
  });

  describe('resolveCottiPlatformAdminSource', () => {
    it('allows the wildcard configuration', () => {
      expect(
        resolveCottiPlatformAdminSource({
          adminEmails: new Set(['*']),
          hasGlobalSuperAdmin: false,
          user: ordinaryUser,
        }),
      ).toBe('wildcard');
    });

    it('matches the normalized email before the original email', () => {
      expect(
        resolveCottiPlatformAdminSource({
          adminEmails: new Set(['admin@example.com']),
          hasGlobalSuperAdmin: false,
          user: {
            email: 'old@example.com',
            normalizedEmail: 'ADMIN@EXAMPLE.COM',
            role: null,
          },
        }),
      ).toBe('email_allowlist');
    });

    it('allows a globally scoped super admin', () => {
      expect(
        resolveCottiPlatformAdminSource({
          adminEmails: new Set(),
          hasGlobalSuperAdmin: true,
          user: ordinaryUser,
        }),
      ).toBe('global_super_admin');
    });

    it('allows a database-managed platform administrator', () => {
      expect(
        resolveCottiPlatformAdminSource({
          adminEmails: new Set(),
          hasDatabaseAssignment: true,
          hasGlobalSuperAdmin: false,
          user: ordinaryUser,
        }),
      ).toBe('database_assignment');
    });

    it('keeps the production Better Auth admin compatibility', () => {
      expect(
        resolveCottiPlatformAdminSource({
          adminEmails: new Set(),
          hasGlobalSuperAdmin: false,
          user: { ...ordinaryUser, role: 'admin' },
        }),
      ).toBe('legacy_admin_role');
    });

    it('denies an ordinary user', () => {
      expect(
        resolveCottiPlatformAdminSource({
          adminEmails: new Set(),
          hasGlobalSuperAdmin: false,
          user: ordinaryUser,
        }),
      ).toBeUndefined();
    });
  });
});
