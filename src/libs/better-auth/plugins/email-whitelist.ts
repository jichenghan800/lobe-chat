import { APIError } from 'better-auth/api';
import { type BetterAuthPlugin } from 'better-auth/types';

import { authEnv } from '@/envs/auth';

/**
 * Parse comma-separated email whitelist string into array.
 */
function parseAllowedEmails(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Check if email is allowed based on whitelist.
 * Supports full email (user@example.com) or domain (example.com).
 */
export function isEmailAllowed(email: string): boolean {
  const allowedList = parseAllowedEmails(authEnv.AUTH_ALLOWED_EMAILS);
  if (allowedList.length === 0) return true;

  const domain = email.split('@')[1];

  return allowedList.some((item) => {
    // Full email match
    if (item.includes('@')) return item === email;
    // Domain match
    return item === domain;
  });
}

/**
 * Better Auth plugin to restrict registration to whitelisted emails/domains.
 * Intercepts user creation (both email signup and SSO) via databaseHooks.
 */
export const emailWhitelist = (): BetterAuthPlugin => ({
  id: 'email-whitelist',
  init() {
    return {
      options: {
        databaseHooks: {
          user: {
            create: {
              before: async (user) => {
                if (!user.email) return { data: user };

                const emailValue = user.email.toLowerCase();
                const domain = emailValue.split('@')[1] || null;
                const allowedList = parseAllowedEmails(authEnv.AUTH_ALLOWED_EMAILS);
                const isAllowed = isEmailAllowed(emailValue);
                console.warn('[auth] email whitelist check', {
                  allowedListCount: allowedList.length,
                  emailDomain: domain,
                  isAllowed,
                });

                if (!isAllowed) {
                  throw new APIError('FORBIDDEN', {
                    code: 'EMAIL_NOT_ALLOWED',
                    message: 'EMAIL_NOT_ALLOWED',
                  });
                }

                return { data: user };
              },
            },
          },
        },
      },
    };
  },
});
