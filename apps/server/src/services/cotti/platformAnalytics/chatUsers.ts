import { and, asc, desc, eq, gte, inArray, lt, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import { messages, users } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import { notCopiedTranscript } from '@/database/utils/copiedTranscript';
import type {
  CottiPlatformAnalyticsChatUserItem,
  CottiPlatformAnalyticsChatUserSort,
  CottiPlatformAnalyticsChatUsersQuery,
} from '@/types/cotti/platformAnalytics';

import {
  buildCottiPlatformAnalyticsContainsCondition,
  cottiPlatformAnalyticsDetailQuerySchema,
  normalizeCottiPlatformAnalyticsDetailQuery,
} from './detailQuery';
import type { ResolvedCottiPlatformAnalyticsPeriod } from './range';
import { cottiMessageUsageNumber } from './usageSql';

const DEFAULT_SORT: CottiPlatformAnalyticsChatUserSort = 'totalTokens';

const chatUserSortSchema = z.enum([
  'assistantMessages',
  'errorMessages',
  'lastActiveAt',
  'recordedCost',
  'totalTokens',
]);

export const cottiPlatformAnalyticsChatUsersQuerySchema =
  cottiPlatformAnalyticsDetailQuerySchema.extend({
    sortBy: chatUserSortSchema.optional(),
  });

const buildUserSearchCondition = (q?: string) => {
  return or(
    buildCottiPlatformAnalyticsContainsCondition(users.email, q),
    buildCottiPlatformAnalyticsContainsCondition(users.fullName, q),
    buildCottiPlatformAnalyticsContainsCondition(users.username, q),
  );
};

const toFiniteNumber = (value: number | null | undefined) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};

export const getCottiPlatformAnalyticsChatUsers = async (
  db: LobeChatDatabase,
  period: ResolvedCottiPlatformAnalyticsPeriod,
  query?: CottiPlatformAnalyticsChatUsersQuery,
): Promise<{
  items: CottiPlatformAnalyticsChatUserItem[];
  page: number;
  pageSize: number;
  total: number;
}> => {
  const { page, pageSize, q, sortBy } = normalizeCottiPlatformAnalyticsDetailQuery(
    query,
    DEFAULT_SORT,
  );
  const inputTokens = cottiMessageUsageNumber('totalInputTokens');
  const outputTokens = cottiMessageUsageNumber('totalOutputTokens');
  const cost = cottiMessageUsageNumber('cost');
  const searchCondition = buildUserSearchCondition(q);
  const whereCondition = and(
    notCopiedTranscript(),
    gte(messages.createdAt, period.startAtDate),
    lt(messages.createdAt, period.endAtDate),
    inArray(messages.role, ['assistant', 'user']),
    searchCondition,
  );
  const activeDays =
    sql<number>`COUNT(DISTINCT (${messages.createdAt} AT TIME ZONE 'Asia/Shanghai')::date) FILTER (WHERE ${messages.role} = 'user')`.mapWith(
      Number,
    );
  const activeTopics =
    sql<number>`COUNT(DISTINCT ${messages.topicId}) FILTER (WHERE ${messages.topicId} IS NOT NULL)`.mapWith(
      Number,
    );
  const assistantMessages =
    sql<number>`COUNT(*) FILTER (WHERE ${messages.role} = 'assistant')`.mapWith(Number);
  const errorMessages =
    sql<number>`COUNT(*) FILTER (WHERE ${messages.role} = 'assistant' AND ${messages.error} IS NOT NULL)`.mapWith(
      Number,
    );
  const lastActiveAt = sql<Date | null>`MAX(${messages.createdAt}) FILTER (
    WHERE ${messages.role} = 'user'
  )`.mapWith(messages.createdAt);
  const recordedCost =
    sql<number>`COALESCE(SUM(${cost}) FILTER (WHERE ${messages.role} = 'assistant'), 0)`.mapWith(
      Number,
    );
  const totalInputTokens =
    sql<number>`COALESCE(SUM(${inputTokens}) FILTER (WHERE ${messages.role} = 'assistant'), 0)`.mapWith(
      Number,
    );
  const totalOutputTokens =
    sql<number>`COALESCE(SUM(${outputTokens}) FILTER (WHERE ${messages.role} = 'assistant'), 0)`.mapWith(
      Number,
    );
  const totalTokens =
    sql<number>`COALESCE(SUM(${inputTokens} + ${outputTokens}) FILTER (WHERE ${messages.role} = 'assistant'), 0)`.mapWith(
      Number,
    );
  const userMessages = sql<number>`COUNT(*) FILTER (WHERE ${messages.role} = 'user')`.mapWith(
    Number,
  );
  const orderBy = (() => {
    switch (sortBy) {
      case 'assistantMessages': {
        return desc(assistantMessages);
      }
      case 'errorMessages': {
        return desc(errorMessages);
      }
      case 'lastActiveAt': {
        return sql`${lastActiveAt} DESC NULLS LAST`;
      }
      case 'recordedCost': {
        return desc(recordedCost);
      }
      case 'totalTokens': {
        return desc(totalTokens);
      }
    }
  })();

  const rows = await db
    .select({
      activeDays,
      activeTopics,
      assistantMessages,
      avatar: users.avatar,
      email: users.email,
      errorMessages,
      fullName: users.fullName,
      lastActiveAt,
      recordedCost,
      total: sql<number>`COUNT(*) OVER()`.mapWith(Number),
      totalInputTokens,
      totalOutputTokens,
      totalTokens,
      userId: users.id,
      userMessages,
      username: users.username,
    })
    .from(messages)
    .innerJoin(users, eq(users.id, messages.userId))
    .where(whereCondition)
    .groupBy(users.id)
    .orderBy(orderBy, asc(users.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  let total = toFiniteNumber(rows[0]?.total);
  if (rows.length === 0 && page > 1) {
    const [totalRow] = await db
      .select({ total: sql<number>`COUNT(DISTINCT ${messages.userId})`.mapWith(Number) })
      .from(messages)
      .innerJoin(users, eq(users.id, messages.userId))
      .where(whereCondition);
    total = toFiniteNumber(totalRow?.total);
  }

  return {
    items: rows.map((row) => ({
      activeDays: toFiniteNumber(row.activeDays),
      activeTopics: toFiniteNumber(row.activeTopics),
      assistantMessages: toFiniteNumber(row.assistantMessages),
      avatar: row.avatar,
      email: row.email,
      errorMessages: toFiniteNumber(row.errorMessages),
      errorRate:
        toFiniteNumber(row.assistantMessages) > 0
          ? toFiniteNumber(row.errorMessages) / toFiniteNumber(row.assistantMessages)
          : 0,
      fullName: row.fullName,
      lastActiveAt: row.lastActiveAt?.toISOString() ?? null,
      recordedCost: toFiniteNumber(row.recordedCost),
      totalInputTokens: toFiniteNumber(row.totalInputTokens),
      totalOutputTokens: toFiniteNumber(row.totalOutputTokens),
      totalTokens: toFiniteNumber(row.totalTokens),
      userId: row.userId,
      userMessages: toFiniteNumber(row.userMessages),
      username: row.username,
    })),
    page,
    pageSize,
    total,
  };
};
