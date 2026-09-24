import { TRPCError } from '@trpc/server';
import { and, eq, isNull, sql } from 'drizzle-orm';

import { CottiPlatformAdminModel } from '@/database/models/cottiPlatformAdmin';
import { roles, userRoles, users } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

const GLOBAL_SUPER_ADMIN_ROLE = 'super_admin';

export type CottiPlatformAdminSource =
  | 'database_assignment'
  | 'email_allowlist'
  | 'global_super_admin'
  | 'legacy_admin_role'
  | 'wildcard';

export interface CottiPlatformAdminIdentity {
  email: null | string;
  normalizedEmail: null | string;
  source: CottiPlatformAdminSource;
  userId: string;
}

interface CottiPlatformAdminUser {
  email: null | string;
  normalizedEmail: null | string;
  role: null | string;
}

interface ResolveCottiPlatformAdminSourceOptions {
  adminEmails: ReadonlySet<string>;
  hasDatabaseAssignment?: boolean;
  hasGlobalSuperAdmin: boolean;
  user: CottiPlatformAdminUser;
}

const normalizeEmail = (email: null | string | undefined) => email?.trim().toLowerCase() || '';

export const parseCottiPlatformAdminEmails = (
  raw = process.env.COTTI_PLATFORM_ANALYTICS_ADMIN_EMAILS,
) =>
  new Set(
    (raw || '')
      .split(/[,;\n]/)
      .map(normalizeEmail)
      .filter(Boolean),
  );

export const resolveCottiPlatformAdminSource = ({
  adminEmails,
  hasDatabaseAssignment,
  hasGlobalSuperAdmin,
  user,
}: ResolveCottiPlatformAdminSourceOptions): CottiPlatformAdminSource | undefined => {
  if (adminEmails.has('*')) return 'wildcard';

  const email = normalizeEmail(user.normalizedEmail || user.email);
  if (email && adminEmails.has(email)) return 'email_allowlist';
  if (hasDatabaseAssignment) return 'database_assignment';
  if (hasGlobalSuperAdmin) return 'global_super_admin';

  // Keep compatibility with the production implementation, where Better Auth
  // administrators were also treated as COTTI platform administrators.
  if (user.role === 'admin') return 'legacy_admin_role';
};

export class CottiPlatformAdminAccessService {
  private db: LobeChatDatabase;
  private userId: string;

  constructor(db: LobeChatDatabase, userId: string) {
    this.db = db;
    this.userId = userId;
  }

  async requireAccess(): Promise<CottiPlatformAdminIdentity> {
    const platformAdminModel = new CottiPlatformAdminModel(this.db);
    const [[user], globalSuperAdminRows, hasDatabaseAssignment] = await Promise.all([
      this.db
        .select({
          email: users.email,
          normalizedEmail: users.normalizedEmail,
          role: users.role,
        })
        .from(users)
        .where(eq(users.id, this.userId))
        .limit(1),
      this.db
        .select({ id: roles.id })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(
          and(
            eq(userRoles.userId, this.userId),
            isNull(userRoles.workspaceId),
            eq(roles.name, GLOBAL_SUPER_ADMIN_ROLE),
            eq(roles.isActive, true),
            sql`(${userRoles.expiresAt} IS NULL OR ${userRoles.expiresAt} > NOW())`,
          ),
        )
        .limit(1),
      platformAdminModel.isAssigned(this.userId).catch((error) => {
        console.error('[CottiPlatformAdminAccess] Database assignment lookup failed:', error);
        return false;
      }),
    ]);

    if (!user) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'COTTI platform admin access denied' });
    }

    const source = resolveCottiPlatformAdminSource({
      adminEmails: parseCottiPlatformAdminEmails(),
      hasDatabaseAssignment,
      hasGlobalSuperAdmin: globalSuperAdminRows.length > 0,
      user,
    });

    if (!source) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'COTTI platform admin access denied' });
    }

    return {
      email: user.email,
      normalizedEmail: user.normalizedEmail,
      source,
      userId: this.userId,
    };
  }
}
