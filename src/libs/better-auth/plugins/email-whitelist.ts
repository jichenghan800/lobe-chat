import { APIError, createAuthMiddleware } from 'better-auth/api';
import { type BetterAuthPlugin } from 'better-auth/types';

import {
  normalizeEmailDomainAlias,
  normalizeEmailIdentity,
  normalizeEmailInput,
} from '@/_custom/services/emailAlias';
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

  const normalizedEmail = normalizeEmailInput(email);
  const emailParts = normalizedEmail.split('@');
  if (emailParts.length !== 2 || !emailParts[0] || !emailParts[1]) return false;

  const canonicalEmail = normalizeEmailIdentity(normalizedEmail);
  const canonicalDomain = normalizeEmailDomainAlias(emailParts[1]);

  return allowedList.some((item) => {
    const normalizedItem = normalizeEmailInput(item);

    if (normalizedItem.includes('@')) {
      return normalizeEmailIdentity(normalizedItem) === canonicalEmail;
    }

    return normalizeEmailDomainAlias(normalizedItem) === canonicalDomain;
  });
}

function getEmailFromBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;

  const email = (body as { email?: unknown }).email;
  return typeof email === 'string' ? email : null;
}

/**
 * Better Auth plugin to restrict registration to whitelisted emails/domains.
 * Intercepts user creation (both email signup and SSO) via databaseHooks.
 */
export const emailWhitelist = (): BetterAuthPlugin => ({
  id: 'email-whitelist',
  hooks: {
    before: [
      {
        matcher: (ctx) => ctx.path === '/sign-in/magic-link' && !!getEmailFromBody(ctx.body),
        handler: createAuthMiddleware(async (ctx) => {
          const email = getEmailFromBody(ctx.body);
          if (!email) return;

          const emailValue = normalizeEmailInput(email);
          if (isEmailAllowed(emailValue)) return;

          throw new APIError('FORBIDDEN', {
            code: 'EMAIL_NOT_ALLOWED',
            message: 'EMAIL_NOT_ALLOWED',
          });
        }),
      },
    ],
  },
  init() {
    return {
      options: {
        databaseHooks: {
          user: {
            create: {
              before: async (user) => {
                if (!user.email) return { data: user };

                const emailValue = normalizeEmailInput(user.email);
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
