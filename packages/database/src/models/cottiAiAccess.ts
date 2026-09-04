import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';

import { cottiAiAccessMembers, cottiAiAuthUsers } from '../schemas';
import type { LobeChatDatabase } from '../type';
import { createNanoId } from '../utils/idGenerator';

export interface UpsertCottiAiAccessMemberParams {
  createdBy?: null | string;
  displayName: string;
  email?: null | string;
  note?: null | string;
  phone?: null | string;
}

export interface UpdateCottiAiAccessMemberParams {
  displayName: string;
  email?: null | string;
  note?: null | string;
  phone?: null | string;
}

export class CottiAiIdentityConflictError extends Error {
  constructor(message = 'Email or phone is already assigned to another COTTI AI member') {
    super(message);
    this.name = 'CottiAiIdentityConflictError';
  }
}

export class CottiAiAuthSchemaUnavailableError extends Error {
  constructor(missingTables: string[]) {
    super(`COTTI AI auth schema is incomplete: ${missingTables.join(', ')}`);
    this.name = 'CottiAiAuthSchemaUnavailableError';
  }
}

const REQUIRED_COTTI_AI_AUTH_TABLES = [
  'access_members',
  'oauthAccessToken',
  'oauthRefreshToken',
  'session',
  'user',
] as const;

export const normalizeCottiAiEmail = (value?: null | string) => value?.trim().toLowerCase() || null;

export const normalizeCottiAiPhone = (value?: null | string) => {
  const digits = value?.replaceAll(/\D/g, '') || '';
  if (/^1[3-9]\d{9}$/.test(digits)) return `+86${digits}`;
  if (/^861[3-9]\d{9}$/.test(digits)) return `+${digits}`;
  return null;
};

const internalEmailForPhone = (phone: string) => `${phone.slice(1)}@phone.auth.cotti.ai`;

export class CottiAiAccessModel {
  constructor(private db: LobeChatDatabase) {}

  async assertSchemaReady() {
    const result = await this.db.execute(sql`
      SELECT table_name AS "tableName"
      FROM information_schema.tables
      WHERE table_schema = 'cotti_ai_auth'
        AND table_name IN (${sql.join(
          REQUIRED_COTTI_AI_AUTH_TABLES.map((tableName) => sql`${tableName}`),
          sql`, `,
        )})
    `);
    const availableTables = new Set(
      (result.rows as { tableName: string }[]).map(({ tableName }) => tableName),
    );
    const missingTables = REQUIRED_COTTI_AI_AUTH_TABLES.filter(
      (tableName) => !availableTables.has(tableName),
    );

    if (missingTables.length > 0) {
      throw new CottiAiAuthSchemaUnavailableError([...missingTables]);
    }
  }

  async list() {
    return this.db
      .select()
      .from(cottiAiAccessMembers)
      .orderBy(desc(cottiAiAccessMembers.createdAt));
  }

  async remove(id: string) {
    const member = await this.get(id);
    if (!member) return;
    if (member.authUserId) await this.revokeAuthArtifacts(member.authUserId);
    await this.db.delete(cottiAiAccessMembers).where(eq(cottiAiAccessMembers.id, id));
  }

  async setEnabled(id: string, enabled: boolean) {
    const [member] = await this.db
      .update(cottiAiAccessMembers)
      .set({ enabled, updatedAt: new Date() })
      .where(eq(cottiAiAccessMembers.id, id))
      .returning();
    if (member && !enabled && member.authUserId) {
      await this.revokeAuthArtifacts(member.authUserId);
    }
    return member;
  }

  async upsert(params: UpsertCottiAiAccessMemberParams) {
    const inputEmail = normalizeCottiAiEmail(params.email);
    const inputPhone = normalizeCottiAiPhone(params.phone);
    const conditions = [
      inputEmail ? eq(cottiAiAccessMembers.email, inputEmail) : undefined,
      inputPhone ? eq(cottiAiAccessMembers.phoneE164, inputPhone) : undefined,
    ].filter((condition) => condition !== undefined);
    const matches = conditions.length
      ? await this.db
          .select()
          .from(cottiAiAccessMembers)
          .where(or(...conditions))
      : [];
    if (new Set(matches.map((member) => member.id)).size > 1) {
      throw new Error('Email and phone belong to different COTTI AI members');
    }

    const email = inputEmail || matches[0]?.email || null;
    const phone = inputPhone || matches[0]?.phoneE164 || null;
    const values = {
      displayName: params.displayName.trim(),
      email,
      enabled: true,
      note: params.note?.trim() || null,
      phoneE164: phone,
      updatedAt: new Date(),
    };
    const [member] = matches[0]
      ? await this.db
          .update(cottiAiAccessMembers)
          .set(values)
          .where(eq(cottiAiAccessMembers.id, matches[0].id))
          .returning()
      : await this.db
          .insert(cottiAiAccessMembers)
          .values({
            ...values,
            createdBy: params.createdBy || null,
            id: `cai_member_${createNanoId(20)()}`,
          })
          .returning();

    return this.provisionAuthUser(member);
  }

  async update(id: string, params: UpdateCottiAiAccessMemberParams) {
    return this.db.transaction(async (tx) => {
      const model = new CottiAiAccessModel(tx as LobeChatDatabase);
      const current = await model.get(id);
      if (!current) return;

      const email = normalizeCottiAiEmail(params.email);
      const phone = normalizeCottiAiPhone(params.phone);
      if (!email && !phone) throw new Error('Email or phone is required');

      const identityConditions = [
        email ? eq(cottiAiAccessMembers.email, email) : undefined,
        phone ? eq(cottiAiAccessMembers.phoneE164, phone) : undefined,
      ].filter((condition) => condition !== undefined);
      const memberMatches = identityConditions.length
        ? await tx
            .select({ id: cottiAiAccessMembers.id })
            .from(cottiAiAccessMembers)
            .where(or(...identityConditions))
        : [];
      if (memberMatches.some((member) => member.id !== id)) {
        throw new CottiAiIdentityConflictError();
      }

      const authEmail = email || internalEmailForPhone(phone!);
      const authIdentityConditions = [
        eq(cottiAiAuthUsers.email, authEmail),
        phone ? eq(cottiAiAuthUsers.phoneNumber, phone) : undefined,
      ].filter((condition) => condition !== undefined);
      const authMatches = await tx
        .select({ id: cottiAiAuthUsers.id })
        .from(cottiAiAuthUsers)
        .where(or(...authIdentityConditions));
      if (authMatches.some((user) => user.id !== current.authUserId)) {
        throw new CottiAiIdentityConflictError(
          'Email or phone is already linked to another COTTI AI account',
        );
      }

      const [member] = await tx
        .update(cottiAiAccessMembers)
        .set({
          displayName: params.displayName.trim(),
          email,
          note: params.note?.trim() || null,
          phoneE164: phone,
          updatedAt: new Date(),
        })
        .where(eq(cottiAiAccessMembers.id, id))
        .returning();
      const linked = await model.provisionAuthUser(member, true);

      if (current.authUserId && (current.email !== email || current.phoneE164 !== phone)) {
        await tx.execute(
          sql`DELETE FROM cotti_ai_auth."oauthAccessToken" WHERE "userId" = ${current.authUserId}`,
        );
        await tx.execute(
          sql`DELETE FROM cotti_ai_auth."oauthRefreshToken" WHERE "userId" = ${current.authUserId}`,
        );
        await tx.execute(
          sql`DELETE FROM cotti_ai_auth."session" WHERE "userId" = ${current.authUserId}`,
        );
      }

      return linked;
    });
  }

  private async get(id: string) {
    const [member] = await this.db
      .select()
      .from(cottiAiAccessMembers)
      .where(eq(cottiAiAccessMembers.id, id))
      .limit(1);
    return member;
  }

  private async provisionAuthUser(
    member: typeof cottiAiAccessMembers.$inferSelect,
    synchronizeIdentities = false,
  ) {
    const userConditions = [
      member.authUserId ? eq(cottiAiAuthUsers.id, member.authUserId) : undefined,
      member.email ? eq(cottiAiAuthUsers.email, member.email) : undefined,
      member.phoneE164 ? eq(cottiAiAuthUsers.phoneNumber, member.phoneE164) : undefined,
    ].filter((condition) => condition !== undefined);
    const users = userConditions.length
      ? await this.db
          .select()
          .from(cottiAiAuthUsers)
          .where(or(...userConditions))
      : [];
    if (new Set(users.map((user) => user.id)).size > 1) {
      throw new Error('COTTI AI identities are already linked to different users');
    }

    const existing = users[0];
    const authUserId = existing?.id || `cai_user_${createNanoId(24)()}`;
    const authEmail = member.email || internalEmailForPhone(member.phoneE164!);
    if (existing) {
      const nextEmail = synchronizeIdentities ? authEmail : member.email || existing.email;
      const nextPhone = synchronizeIdentities
        ? member.phoneE164
        : member.phoneE164 || existing.phoneNumber;
      await this.db
        .update(cottiAiAuthUsers)
        .set({
          email: nextEmail,
          emailVerified: existing.email === nextEmail ? existing.emailVerified : false,
          name: member.displayName,
          phoneNumber: nextPhone,
          phoneNumberVerified:
            existing.phoneNumber === nextPhone ? existing.phoneNumberVerified : false,
          updatedAt: new Date(),
        })
        .where(eq(cottiAiAuthUsers.id, existing.id));
    } else {
      await this.db.insert(cottiAiAuthUsers).values({
        email: authEmail,
        emailVerified: false,
        id: authUserId,
        name: member.displayName,
        phoneNumber: member.phoneE164,
        phoneNumberVerified: false,
      });
    }

    const [linked] = await this.db
      .update(cottiAiAccessMembers)
      .set({ authUserId, updatedAt: new Date() })
      .where(
        and(
          eq(cottiAiAccessMembers.id, member.id),
          or(
            eq(cottiAiAccessMembers.authUserId, authUserId),
            isNull(cottiAiAccessMembers.authUserId),
          ),
        ),
      )
      .returning();
    return linked || member;
  }

  private async revokeAuthArtifacts(userId: string) {
    await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`DELETE FROM cotti_ai_auth."oauthAccessToken" WHERE "userId" = ${userId}`,
      );
      await tx.execute(
        sql`DELETE FROM cotti_ai_auth."oauthRefreshToken" WHERE "userId" = ${userId}`,
      );
      await tx.execute(sql`DELETE FROM cotti_ai_auth."session" WHERE "userId" = ${userId}`);
    });
  }
}
