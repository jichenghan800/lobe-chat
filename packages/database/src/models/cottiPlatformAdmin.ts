import { desc, eq } from 'drizzle-orm';

import { cottiPlatformAdminAssignments, users } from '../schemas';
import type { LobeChatDatabase } from '../type';

export interface CottiPlatformAdminAssignmentWithUser {
  createdAt: Date;
  createdBy: null | string;
  id: string;
  note: null | string;
  updatedAt: Date;
  user: {
    email: null | string;
    fullName: null | string;
    id: string;
    normalizedEmail: null | string;
    username: null | string;
  };
  userId: string;
}

export class CottiPlatformAdminModel {
  constructor(private db: LobeChatDatabase) {}

  async add(userId: string, createdBy?: null | string, note?: null | string) {
    const [assignment] = await this.db
      .insert(cottiPlatformAdminAssignments)
      .values({ createdBy: createdBy ?? null, note: note?.trim() || null, userId })
      .onConflictDoUpdate({
        set: { note: note?.trim() || null, updatedAt: new Date() },
        target: cottiPlatformAdminAssignments.userId,
      })
      .returning();

    return assignment;
  }

  async isAssigned(userId: string) {
    const [assignment] = await this.db
      .select({ id: cottiPlatformAdminAssignments.id })
      .from(cottiPlatformAdminAssignments)
      .where(eq(cottiPlatformAdminAssignments.userId, userId))
      .limit(1);

    return Boolean(assignment);
  }

  async list(): Promise<CottiPlatformAdminAssignmentWithUser[]> {
    return this.db
      .select({
        createdAt: cottiPlatformAdminAssignments.createdAt,
        createdBy: cottiPlatformAdminAssignments.createdBy,
        id: cottiPlatformAdminAssignments.id,
        note: cottiPlatformAdminAssignments.note,
        updatedAt: cottiPlatformAdminAssignments.updatedAt,
        user: {
          email: users.email,
          fullName: users.fullName,
          id: users.id,
          normalizedEmail: users.normalizedEmail,
          username: users.username,
        },
        userId: cottiPlatformAdminAssignments.userId,
      })
      .from(cottiPlatformAdminAssignments)
      .innerJoin(users, eq(users.id, cottiPlatformAdminAssignments.userId))
      .orderBy(desc(cottiPlatformAdminAssignments.createdAt));
  }

  async remove(id: string) {
    return this.db.transaction(async (tx) => {
      const assignments = await tx
        .select({ id: cottiPlatformAdminAssignments.id })
        .from(cottiPlatformAdminAssignments)
        .for('update');
      if (assignments.length <= 1) return false;

      const [removed] = await tx
        .delete(cottiPlatformAdminAssignments)
        .where(eq(cottiPlatformAdminAssignments.id, id))
        .returning({ id: cottiPlatformAdminAssignments.id });

      return Boolean(removed);
    });
  }
}
