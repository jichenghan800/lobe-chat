import { and, desc, eq, gte, lt, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import { messages } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import { notCopiedTranscript } from '@/database/utils/copiedTranscript';
import type {
  CottiPlatformAnalyticsChatModelItem,
  CottiPlatformAnalyticsChatModelSort,
  CottiPlatformAnalyticsChatModelsQuery,
} from '@/types/cotti/platformAnalytics';

import {
  buildCottiPlatformAnalyticsContainsCondition,
  cottiPlatformAnalyticsDetailQuerySchema,
  normalizeCottiPlatformAnalyticsDetailQuery,
} from './detailQuery';
import type { ResolvedCottiPlatformAnalyticsPeriod } from './range';
import { cottiMessageUsageNumber } from './usageSql';

const DEFAULT_SORT: CottiPlatformAnalyticsChatModelSort = 'totalTokens';

const chatModelSortSchema = z.enum([
  'activeUsers',
  'assistantMessages',
  'errorMessages',
  'recordedCost',
  'totalTokens',
]);

export const cottiPlatformAnalyticsChatModelsQuerySchema =
  cottiPlatformAnalyticsDetailQuerySchema.extend({
    sortBy: chatModelSortSchema.optional(),
  });

const buildModelSearchCondition = (q?: string) => {
  return or(
    buildCottiPlatformAnalyticsContainsCondition(messages.model, q),
    buildCottiPlatformAnalyticsContainsCondition(messages.provider, q),
  );
};

const toFiniteNumber = (value: number | null | undefined) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};

export const getCottiPlatformAnalyticsChatModels = async (
  db: LobeChatDatabase,
  period: ResolvedCottiPlatformAnalyticsPeriod,
  query?: CottiPlatformAnalyticsChatModelsQuery,
): Promise<{
  items: CottiPlatformAnalyticsChatModelItem[];
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
  const searchCondition = buildModelSearchCondition(q);
  const whereCondition = and(
    notCopiedTranscript(),
    gte(messages.createdAt, period.startAtDate),
    lt(messages.createdAt, period.endAtDate),
    eq(messages.role, 'assistant'),
    searchCondition,
  );
  const activeUsers = sql<number>`COUNT(DISTINCT ${messages.userId})`.mapWith(Number);
  const assistantMessages = sql<number>`COUNT(*)`.mapWith(Number);
  const errorMessages = sql<number>`COUNT(*) FILTER (WHERE ${messages.error} IS NOT NULL)`.mapWith(
    Number,
  );
  const recordedCost = sql<number>`COALESCE(SUM(${cost}), 0)`.mapWith(Number);
  const totalInputTokens = sql<number>`COALESCE(SUM(${inputTokens}), 0)`.mapWith(Number);
  const totalOutputTokens = sql<number>`COALESCE(SUM(${outputTokens}), 0)`.mapWith(Number);
  const totalTokens = sql<number>`COALESCE(SUM(${inputTokens} + ${outputTokens}), 0)`.mapWith(
    Number,
  );
  const orderBy = (() => {
    switch (sortBy) {
      case 'activeUsers': {
        return desc(activeUsers);
      }
      case 'assistantMessages': {
        return desc(assistantMessages);
      }
      case 'errorMessages': {
        return desc(errorMessages);
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
      activeUsers,
      assistantMessages,
      errorMessages,
      model: messages.model,
      provider: messages.provider,
      recordedCost,
      total: sql<number>`COUNT(*) OVER()`.mapWith(Number),
      totalInputTokens,
      totalOutputTokens,
      totalTokens,
    })
    .from(messages)
    .where(whereCondition)
    .groupBy(messages.provider, messages.model)
    .orderBy(
      orderBy,
      sql`${messages.provider} ASC NULLS LAST`,
      sql`${messages.model} ASC NULLS LAST`,
    )
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  let total = toFiniteNumber(rows[0]?.total);
  if (rows.length === 0 && page > 1) {
    const modelGroups = db
      .select({ model: messages.model, provider: messages.provider })
      .from(messages)
      .where(whereCondition)
      .groupBy(messages.provider, messages.model)
      .as('cotti_platform_chat_model_groups');
    const [totalRow] = await db
      .select({ total: sql<number>`COUNT(*)`.mapWith(Number) })
      .from(modelGroups);
    total = toFiniteNumber(totalRow?.total);
  }

  return {
    items: rows.map((row) => {
      const modelErrorMessages = toFiniteNumber(row.errorMessages);
      const modelAssistantMessages = toFiniteNumber(row.assistantMessages);

      return {
        activeUsers: toFiniteNumber(row.activeUsers),
        assistantMessages: modelAssistantMessages,
        errorMessages: modelErrorMessages,
        errorRate: modelAssistantMessages > 0 ? modelErrorMessages / modelAssistantMessages : 0,
        model: row.model,
        provider: row.provider,
        recordedCost: toFiniteNumber(row.recordedCost),
        totalInputTokens: toFiniteNumber(row.totalInputTokens),
        totalOutputTokens: toFiniteNumber(row.totalOutputTokens),
        totalTokens: toFiniteNumber(row.totalTokens),
      };
    }),
    page,
    pageSize,
    total,
  };
};
