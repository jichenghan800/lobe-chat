import type { SQLWrapper } from 'drizzle-orm';
import { and, desc, eq, gte, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import { agentOperations, agents, messages } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import { notCopiedTranscript } from '@/database/utils/copiedTranscript';
import type {
  CottiPlatformAnalyticsAgentErrorItem,
  CottiPlatformAnalyticsAgentErrorSort,
  CottiPlatformAnalyticsAgentErrorsQuery,
  CottiPlatformAnalyticsChatErrorItem,
  CottiPlatformAnalyticsChatErrorSort,
  CottiPlatformAnalyticsChatErrorsQuery,
} from '@/types/cotti/platformAnalytics';

import {
  buildCottiPlatformAnalyticsContainsCondition,
  cottiPlatformAnalyticsDetailQuerySchema,
  normalizeCottiPlatformAnalyticsDetailQuery,
} from './detailQuery';
import type { ResolvedCottiPlatformAnalyticsPeriod } from './range';

const DEFAULT_AGENT_ERROR_SORT: CottiPlatformAnalyticsAgentErrorSort = 'errorExecutions';
const DEFAULT_CHAT_ERROR_SORT: CottiPlatformAnalyticsChatErrorSort = 'errorMessages';

const agentErrorSortSchema = z.enum(['affectedUsers', 'errorExecutions']);
const chatErrorSortSchema = z.enum(['affectedUsers', 'errorMessages']);

export const cottiPlatformAnalyticsAgentErrorsQuerySchema =
  cottiPlatformAnalyticsDetailQuerySchema.extend({
    sortBy: agentErrorSortSchema.optional(),
  });

export const cottiPlatformAnalyticsChatErrorsQuerySchema =
  cottiPlatformAnalyticsDetailQuerySchema.extend({
    sortBy: chatErrorSortSchema.optional(),
  });

const buildSafeErrorCategory = (error: SQLWrapper) => sql<string | null>`COALESCE(
  NULLIF(BTRIM(${error}->>'category'), ''),
  NULLIF(BTRIM(${error}->>'type'), ''),
  NULLIF(BTRIM(${error}->>'name'), ''),
  NULLIF(BTRIM(${error}->>'errorType'), ''),
  NULLIF(BTRIM(${error}->>'code'), '')
)`;

const toFiniteNumber = (value: number | null | undefined) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};

export const getCottiPlatformAnalyticsChatErrors = async (
  db: LobeChatDatabase,
  period: ResolvedCottiPlatformAnalyticsPeriod,
  query?: CottiPlatformAnalyticsChatErrorsQuery,
): Promise<{
  items: CottiPlatformAnalyticsChatErrorItem[];
  page: number;
  pageSize: number;
  total: number;
}> => {
  const { page, pageSize, q, sortBy } = normalizeCottiPlatformAnalyticsDetailQuery(
    query,
    DEFAULT_CHAT_ERROR_SORT,
  );
  const category = buildSafeErrorCategory(messages.error);
  const searchCondition = or(
    buildCottiPlatformAnalyticsContainsCondition(messages.provider, q),
    buildCottiPlatformAnalyticsContainsCondition(messages.model, q),
    buildCottiPlatformAnalyticsContainsCondition(category, q),
  );
  const whereCondition = and(
    notCopiedTranscript(),
    gte(messages.createdAt, period.startAtDate),
    lt(messages.createdAt, period.endAtDate),
    eq(messages.role, 'assistant'),
    isNotNull(messages.error),
    searchCondition,
  );
  const affectedUsers = sql<number>`COUNT(DISTINCT ${messages.userId})`.mapWith(Number);
  const errorMessages = sql<number>`COUNT(*)`.mapWith(Number);
  const orderBy = sortBy === 'affectedUsers' ? desc(affectedUsers) : desc(errorMessages);

  const rows = await db
    .select({
      affectedUsers,
      category,
      errorMessages,
      model: messages.model,
      provider: messages.provider,
      total: sql<number>`COUNT(*) OVER()`.mapWith(Number),
    })
    .from(messages)
    .where(whereCondition)
    .groupBy(messages.provider, messages.model, category)
    .orderBy(
      orderBy,
      sql`${messages.provider} ASC NULLS LAST`,
      sql`${messages.model} ASC NULLS LAST`,
      sql`${category} ASC NULLS LAST`,
    )
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  let total = toFiniteNumber(rows[0]?.total);
  if (rows.length === 0 && page > 1) {
    const errorGroups = db
      .select({ category, model: messages.model, provider: messages.provider })
      .from(messages)
      .where(whereCondition)
      .groupBy(messages.provider, messages.model, category)
      .as('cotti_platform_chat_error_groups');
    const [totalRow] = await db
      .select({ total: sql<number>`COUNT(*)`.mapWith(Number) })
      .from(errorGroups);
    total = toFiniteNumber(totalRow?.total);
  }

  return {
    items: rows.map((row) => ({
      affectedUsers: toFiniteNumber(row.affectedUsers),
      category: row.category,
      errorMessages: toFiniteNumber(row.errorMessages),
      model: row.model,
      provider: row.provider,
    })),
    page,
    pageSize,
    total,
  };
};

export const getCottiPlatformAnalyticsAgentErrors = async (
  db: LobeChatDatabase,
  period: ResolvedCottiPlatformAnalyticsPeriod,
  query?: CottiPlatformAnalyticsAgentErrorsQuery,
): Promise<{
  items: CottiPlatformAnalyticsAgentErrorItem[];
  page: number;
  pageSize: number;
  total: number;
}> => {
  const { page, pageSize, q, sortBy } = normalizeCottiPlatformAnalyticsDetailQuery(
    query,
    DEFAULT_AGENT_ERROR_SORT,
  );
  const category = buildSafeErrorCategory(agentOperations.error);
  const errorGroups = db
    .select({
      affectedUsers: sql<number>`COUNT(DISTINCT ${agentOperations.userId})`
        .mapWith(Number)
        .as('affected_users'),
      agentId: agentOperations.agentId,
      category: category.as('category'),
      errorExecutions: sql<number>`COUNT(*)`.mapWith(Number).as('error_executions'),
    })
    .from(agentOperations)
    .where(
      and(
        gte(agentOperations.createdAt, period.startAtDate),
        lt(agentOperations.createdAt, period.endAtDate),
        isNull(agentOperations.parentOperationId),
        eq(agentOperations.status, 'error'),
      ),
    )
    .groupBy(agentOperations.agentId, category)
    .as('cotti_platform_agent_error_groups');
  const searchCondition = or(
    buildCottiPlatformAnalyticsContainsCondition(agents.title, q),
    buildCottiPlatformAnalyticsContainsCondition(errorGroups.category, q),
  );
  const orderBy =
    sortBy === 'affectedUsers'
      ? desc(errorGroups.affectedUsers)
      : desc(errorGroups.errorExecutions);

  const rows = await db
    .select({
      affectedUsers: errorGroups.affectedUsers,
      agentId: errorGroups.agentId,
      avatar: agents.avatar,
      category: errorGroups.category,
      errorExecutions: errorGroups.errorExecutions,
      title: agents.title,
      total: sql<number>`COUNT(*) OVER()`.mapWith(Number),
    })
    .from(errorGroups)
    .leftJoin(agents, eq(agents.id, errorGroups.agentId))
    .where(searchCondition)
    .orderBy(
      orderBy,
      sql`${errorGroups.agentId} ASC NULLS LAST`,
      sql`${errorGroups.category} ASC NULLS LAST`,
    )
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  let total = toFiniteNumber(rows[0]?.total);
  if (rows.length === 0 && page > 1) {
    const [totalRow] = await db
      .select({ total: sql<number>`COUNT(*)`.mapWith(Number) })
      .from(errorGroups)
      .leftJoin(agents, eq(agents.id, errorGroups.agentId))
      .where(searchCondition);
    total = toFiniteNumber(totalRow?.total);
  }

  return {
    items: rows.map((row) => ({
      affectedUsers: toFiniteNumber(row.affectedUsers),
      agentId: row.agentId,
      avatar: row.avatar,
      category: row.category,
      errorExecutions: toFiniteNumber(row.errorExecutions),
      title: row.title,
    })),
    page,
    pageSize,
    total,
  };
};
