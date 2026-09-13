import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { unionAll } from 'drizzle-orm/pg-core';

import {
  asyncTasks,
  generationBatches,
  generations,
  generationTopics,
  messagePlugins,
  messages,
  messagesFiles,
} from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import { notCopiedTranscript } from '@/database/utils/copiedTranscript';
import type {
  CottiPlatformAnalyticsFileFeature,
  CottiPlatformAnalyticsGenerationFeature,
  CottiPlatformAnalyticsGenerationType,
  CottiPlatformAnalyticsSearchFeature,
  CottiPlatformAnalyticsToolFeature,
} from '@/types/cotti/platformAnalytics';

import type { ResolvedCottiPlatformAnalyticsPeriod } from './range';

const GENERATION_TYPES = [
  'image',
  'video',
] as const satisfies CottiPlatformAnalyticsGenerationType[];

const toFiniteNumber = (value: number | null | undefined) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};

const getSearchFeature = async (
  db: LobeChatDatabase,
  period: ResolvedCottiPlatformAnalyticsPeriod,
): Promise<CottiPlatformAnalyticsSearchFeature> => {
  const meaningfulBuiltinSearch = sql<boolean>`
    ${messages.search} IS NOT NULL
    AND (
      jsonb_path_exists(${messages.search}, '$.searchQueries[*]')
      OR jsonb_path_exists(${messages.search}, '$.citations[*]')
      OR jsonb_path_exists(${messages.search}, '$.imageSearchQueries[*]')
      OR jsonb_path_exists(${messages.search}, '$.imageResults[*]')
    )
  `;
  const builtinSearchEvents = db
    .select({
      eventType: sql<'builtin' | 'webTool'>`'builtin'`.as('event_type'),
      userId: messages.userId,
    })
    .from(messages)
    .where(
      and(
        notCopiedTranscript(),
        gte(messages.createdAt, period.startAtDate),
        lt(messages.createdAt, period.endAtDate),
        eq(messages.role, 'assistant'),
        meaningfulBuiltinSearch,
      ),
    );
  const webSearchToolEvents = db
    .select({
      eventType: sql<'builtin' | 'webTool'>`'webTool'`.as('event_type'),
      userId: messagePlugins.userId,
    })
    .from(messagePlugins)
    .innerJoin(messages, eq(messages.id, messagePlugins.id))
    .where(
      and(
        notCopiedTranscript(),
        gte(messages.createdAt, period.startAtDate),
        lt(messages.createdAt, period.endAtDate),
        eq(messagePlugins.identifier, 'lobe-web-browsing'),
        eq(messagePlugins.apiName, 'search'),
      ),
    );
  const searchEvents = unionAll(builtinSearchEvents, webSearchToolEvents).as(
    'cotti_platform_search_events',
  );
  const [row] = await db
    .select({
      activeUsers: sql<number>`COUNT(DISTINCT ${searchEvents.userId})`.mapWith(Number),
      builtinSearchMessages:
        sql<number>`COUNT(*) FILTER (WHERE ${searchEvents.eventType} = 'builtin')`.mapWith(Number),
      totalSearchEvents: sql<number>`COUNT(*)`.mapWith(Number),
      webSearchToolResults:
        sql<number>`COUNT(*) FILTER (WHERE ${searchEvents.eventType} = 'webTool')`.mapWith(Number),
    })
    .from(searchEvents);

  return {
    activeUsers: toFiniteNumber(row?.activeUsers),
    builtinSearchMessages: toFiniteNumber(row?.builtinSearchMessages),
    totalSearchEvents: toFiniteNumber(row?.totalSearchEvents),
    webSearchToolResults: toFiniteNumber(row?.webSearchToolResults),
  };
};

const getToolFeature = async (
  db: LobeChatDatabase,
  period: ResolvedCottiPlatformAnalyticsPeriod,
): Promise<CottiPlatformAnalyticsToolFeature> => {
  const [row] = await db
    .select({
      activeUsers: sql<number>`COUNT(DISTINCT ${messagePlugins.userId})`.mapWith(Number),
      errorResults:
        sql<number>`COUNT(*) FILTER (WHERE ${messagePlugins.error} IS NOT NULL)`.mapWith(Number),
      rejectedOrAbortedResults: sql<number>`COUNT(*) FILTER (
        WHERE ${messagePlugins.intervention}->>'status' IN ('rejected', 'aborted')
      )`.mapWith(Number),
      results: sql<number>`COUNT(*)`.mapWith(Number),
    })
    .from(messagePlugins)
    .innerJoin(messages, eq(messages.id, messagePlugins.id))
    .where(
      and(
        notCopiedTranscript(),
        gte(messages.createdAt, period.startAtDate),
        lt(messages.createdAt, period.endAtDate),
      ),
    );

  return {
    activeUsers: toFiniteNumber(row?.activeUsers),
    errorResults: toFiniteNumber(row?.errorResults),
    rejectedOrAbortedResults: toFiniteNumber(row?.rejectedOrAbortedResults),
    results: toFiniteNumber(row?.results),
  };
};

const getFileFeature = async (
  db: LobeChatDatabase,
  period: ResolvedCottiPlatformAnalyticsPeriod,
): Promise<CottiPlatformAnalyticsFileFeature> => {
  const [row] = await db
    .select({
      activeUsers: sql<number>`COUNT(DISTINCT ${messagesFiles.userId})`.mapWith(Number),
      distinctFiles: sql<number>`COUNT(DISTINCT ${messagesFiles.fileId})`.mapWith(Number),
      fileRelations: sql<number>`COUNT(*)`.mapWith(Number),
      messagesWithFiles: sql<number>`COUNT(DISTINCT ${messagesFiles.messageId})`.mapWith(Number),
    })
    .from(messagesFiles)
    .innerJoin(messages, eq(messages.id, messagesFiles.messageId))
    .where(
      and(
        notCopiedTranscript(),
        gte(messages.createdAt, period.startAtDate),
        lt(messages.createdAt, period.endAtDate),
        eq(messages.role, 'user'),
      ),
    );

  return {
    activeUsers: toFiniteNumber(row?.activeUsers),
    distinctFiles: toFiniteNumber(row?.distinctFiles),
    fileRelations: toFiniteNumber(row?.fileRelations),
    messagesWithFiles: toFiniteNumber(row?.messagesWithFiles),
  };
};

const createEmptyGenerationFeature = (
  type: CottiPlatformAnalyticsGenerationType,
): CottiPlatformAnalyticsGenerationFeature => ({
  activeUsers: 0,
  errorResults: 0,
  requests: 0,
  requestsWithoutResults: 0,
  resultRows: 0,
  successfulAssets: 0,
  type,
});

const getGenerationFeatures = async (
  db: LobeChatDatabase,
  period: ResolvedCottiPlatformAnalyticsPeriod,
): Promise<CottiPlatformAnalyticsGenerationFeature[]> => {
  const rows = await db
    .select({
      activeUsers: sql<number>`COUNT(DISTINCT ${generationBatches.userId})`.mapWith(Number),
      errorResults:
        sql<number>`COUNT(${generations.id}) FILTER (WHERE ${asyncTasks.status} = 'error')`.mapWith(
          Number,
        ),
      requests: sql<number>`COUNT(DISTINCT ${generationBatches.id})`.mapWith(Number),
      requestsWithoutResults:
        sql<number>`COUNT(DISTINCT ${generationBatches.id}) FILTER (WHERE ${generations.id} IS NULL)`.mapWith(
          Number,
        ),
      resultRows: sql<number>`COUNT(${generations.id})`.mapWith(Number),
      successfulAssets: sql<number>`COUNT(${generations.id}) FILTER (
        WHERE ${asyncTasks.status} = 'success' AND ${generations.fileId} IS NOT NULL
      )`.mapWith(Number),
      type: generationTopics.type,
    })
    .from(generationBatches)
    .innerJoin(generationTopics, eq(generationTopics.id, generationBatches.generationTopicId))
    .leftJoin(generations, eq(generations.generationBatchId, generationBatches.id))
    .leftJoin(asyncTasks, eq(asyncTasks.id, generations.asyncTaskId))
    .where(
      and(
        gte(generationBatches.createdAt, period.startAtDate),
        lt(generationBatches.createdAt, period.endAtDate),
        inArray(generationTopics.type, GENERATION_TYPES),
      ),
    )
    .groupBy(generationTopics.type);
  const byType = new Map<
    CottiPlatformAnalyticsGenerationType,
    CottiPlatformAnalyticsGenerationFeature
  >();

  for (const row of rows) {
    if (row.type !== 'image' && row.type !== 'video') continue;

    byType.set(row.type, {
      activeUsers: toFiniteNumber(row.activeUsers),
      errorResults: toFiniteNumber(row.errorResults),
      requests: toFiniteNumber(row.requests),
      requestsWithoutResults: toFiniteNumber(row.requestsWithoutResults),
      resultRows: toFiniteNumber(row.resultRows),
      successfulAssets: toFiniteNumber(row.successfulAssets),
      type: row.type,
    });
  }

  return GENERATION_TYPES.map((type) => byType.get(type) ?? createEmptyGenerationFeature(type));
};

export const getCottiPlatformAnalyticsFeatures = async (
  db: LobeChatDatabase,
  period: ResolvedCottiPlatformAnalyticsPeriod,
) => {
  const [files, generationsResult, search, tools] = await Promise.all([
    getFileFeature(db, period),
    getGenerationFeatures(db, period),
    getSearchFeature(db, period),
    getToolFeature(db, period),
  ]);

  return { files, generations: generationsResult, search, tools };
};
