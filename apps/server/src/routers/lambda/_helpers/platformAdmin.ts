import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import { users } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

const parsePlatformAdminEmails = () =>
  (process.env.COTTI_PLATFORM_ANALYTICS_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export interface PlatformAdminUser {
  email: null | string;
  normalizedEmail: null | string;
  role: null | string;
}

export const resolvePlatformAdminUser = async (
  db: LobeChatDatabase,
  userId: string,
): Promise<PlatformAdminUser> => {
  const [user] = await db
    .select({
      email: users.email,
      normalizedEmail: users.normalizedEmail,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const adminEmails = parsePlatformAdminEmails();
  const email = (user?.normalizedEmail || user?.email || '').toLowerCase();
  const isAllowedByEmail = adminEmails.includes('*') || (!!email && adminEmails.includes(email));
  const isAdminRole = user?.role === 'admin';

  if (!isAllowedByEmail && !isAdminRole) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Platform admin access denied.' });
  }

  return {
    email: user?.email ?? null,
    normalizedEmail: user?.normalizedEmail ?? null,
    role: user?.role ?? null,
  };
};

export const assertPlatformAdminAccess = async (db: LobeChatDatabase, userId: string) => {
  await resolvePlatformAdminUser(db, userId);
};
