import { desc, eq } from 'drizzle-orm';

import { session as authSessions, users } from '../schemas';
import type { LobeChatDatabase } from '../type';

export interface CottiDisabledLoginUser {
  banReason: null | string;
  email: null | string;
  fullName: null | string;
  id: string;
  normalizedEmail: null | string;
  updatedAt: Date;
  username: null | string;
}

interface SetLoginDisabledResult {
  sessionTokens: string[];
  user: CottiDisabledLoginUser;
}

export class CottiUserLoginControlModel {
  constructor(private db: LobeChatDatabase) {}

  async listDisabled(): Promise<CottiDisabledLoginUser[]> {
    return this.db
      .select({
        banReason: users.banReason,
        email: users.email,
        fullName: users.fullName,
        id: users.id,
        normalizedEmail: users.normalizedEmail,
        updatedAt: users.updatedAt,
        username: users.username,
      })
      .from(users)
      .where(eq(users.banned, true))
      .orderBy(desc(users.updatedAt));
  }

  async setLoginDisabled(
    userId: string,
    disabled: boolean,
    reason?: string,
  ): Promise<SetLoginDisabledResult | undefined> {
    return this.db.transaction(async (tx) => {
      const [existingUser] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
        .for('update');
      if (!existingUser) return undefined;

      const sessionRows = disabled
        ? await tx
            .select({ token: authSessions.token })
            .from(authSessions)
            .where(eq(authSessions.userId, userId))
        : [];
      const [user] = await tx
        .update(users)
        .set({
          banExpires: null,
          banReason: disabled ? reason?.trim() || 'Disabled by platform administrator' : null,
          banned: disabled,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning({
          banReason: users.banReason,
          email: users.email,
          fullName: users.fullName,
          id: users.id,
          normalizedEmail: users.normalizedEmail,
          updatedAt: users.updatedAt,
          username: users.username,
        });

      if (disabled) await tx.delete(authSessions).where(eq(authSessions.userId, userId));

      return { sessionTokens: sessionRows.map(({ token }) => token), user };
    });
  }
}
