import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import { users } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

const parsePlatformAdminEmails = () =>
  (process.env.COTTI_PLATFORM_ANALYTICS_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export const assertPlatformAdminAccess = async (db: LobeChatDatabase, userId: string) => {
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
};
