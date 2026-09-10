import { and, count, desc, eq, ilike, isNull, or } from 'drizzle-orm';

import { cottiUserPolicies, users } from '../schemas';
import type { LobeChatDatabase, Transaction } from '../type';

export interface CottiUserPolicyInput {
  agentEnabled: boolean;
  topicLimitFen: number | null;
  vip: boolean;
}

export class CottiUserPolicyModel {
  constructor(private db: LobeChatDatabase | Transaction) {}

  async get(userId: string): Promise<CottiUserPolicyInput> {
    const [row] = await this.db
      .select()
      .from(cottiUserPolicies)
      .where(eq(cottiUserPolicies.userId, userId))
      .limit(1);
    return {
      agentEnabled: row?.agentEnabled ?? false,
      topicLimitFen: row?.topicLimitFen ?? null,
      vip: row?.vip ?? false,
    };
  }

  async list(input: {
    page: number;
    pageSize: number;
    query?: string;
    vip?: boolean;
    agentEnabled?: boolean;
  }) {
    const query = input.query?.trim();
    const filter = and(
      query
        ? or(
            ilike(users.email, `%${query}%`),
            ilike(users.normalizedEmail, `%${query}%`),
            ilike(users.fullName, `%${query}%`),
            ilike(users.username, `%${query}%`),
            ilike(users.phone, `%${query}%`),
          )
        : undefined,
      input.vip === undefined
        ? undefined
        : input.vip
          ? eq(cottiUserPolicies.vip, true)
          : or(eq(cottiUserPolicies.vip, false), isNull(cottiUserPolicies.vip)),
      input.agentEnabled === undefined
        ? undefined
        : input.agentEnabled
          ? eq(cottiUserPolicies.agentEnabled, true)
          : or(eq(cottiUserPolicies.agentEnabled, false), isNull(cottiUserPolicies.agentEnabled)),
    );
    const rows = await this.db
      .select({
        id: users.id,
        fullName: users.fullName,
        username: users.username,
        email: users.email,
        phone: users.phone,
        lastActiveAt: users.lastActiveAt,
        banned: users.banned,
        policy: cottiUserPolicies,
      })
      .from(users)
      .leftJoin(cottiUserPolicies, eq(users.id, cottiUserPolicies.userId))
      .where(filter)
      .orderBy(desc(users.lastActiveAt), users.id)
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize);
    const [total] = await this.db
      .select({ count: count() })
      .from(users)
      .leftJoin(cottiUserPolicies, eq(users.id, cottiUserPolicies.userId))
      .where(filter);
    return {
      total: total.count,
      items: rows.map(({ policy, ...user }) => ({
        ...user,
        vip: policy?.vip ?? false,
        agentEnabled: policy?.agentEnabled ?? false,
        topicLimitFen: policy?.topicLimitFen ?? null,
      })),
    };
  }

  async update(userId: string, policy: CottiUserPolicyInput, updatedBy: string) {
    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) throw new Error('User not found');
    await this.db
      .insert(cottiUserPolicies)
      .values({ userId, ...policy, updatedBy })
      .onConflictDoUpdate({
        target: cottiUserPolicies.userId,
        set: { ...policy, updatedBy, updatedAt: new Date() },
      });
    return this.get(userId);
  }
}
