import { APIError } from 'better-auth/api';
import { type BetterAuthPlugin } from 'better-auth/types';

import { authEnv } from '@/envs/auth';

interface EmailWhitelistOptions {
  isAllowed?: (email: string) => boolean | Promise<boolean>;
}

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
export const emailWhitelist = (options: EmailWhitelistOptions = {}): BetterAuthPlugin => ({
  id: 'email-whitelist',
  init() {
    return {
      options: {
        databaseHooks: {
          user: {
            create: {
              before: async (user, context) => {
                if (!user.email) return { data: user };

                // This hook runs after Better Auth validates OAuth state, exchanges the
                // code and loads the provider profile. Only this Portal deployment
                // delegates admission; email/OTP signup and other providers retain
                // the product's local whitelist.
                const portalIssuers = [
                  'https://auth.cotti.ai/api/auth',
                  'https://auth.cotti.ai/api/auth/.well-known/openid-configuration',
                  'http://cotti-portal:3700/api/auth/.well-known/openid-configuration',
                ];
                if (
                  process.env.COTTI_PORTAL_MANAGED_ACCESS === '1' &&
                  process.env.APP_URL === 'https://chat.cotti.ai' &&
                  process.env.AUTH_GENERIC_OIDC_ID === 'cotti-chat' &&
                  portalIssuers.includes(process.env.AUTH_GENERIC_OIDC_ISSUER ?? '') &&
                  ((context?.params?.providerId === 'generic-oidc' &&
                    (context.path === '/oauth2/callback/generic-oidc' ||
                      context.path === '/oauth2/callback/:providerId')) ||
                    (context?.params?.id === 'generic-oidc' &&
                      (context.path === '/callback/generic-oidc' ||
                        context.path === '/callback/:id')))
                ) {
                  return { data: user };
                }

                const allowed = await (options.isAllowed?.(user.email) ??
                  isEmailAllowed(user.email));

                if (!allowed) {
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
