import { and, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import { z } from 'zod';

import { agentOperations, agents } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import type {
  CottiPlatformAnalyticsAgentItem,
  CottiPlatformAnalyticsAgentSort,
  CottiPlatformAnalyticsAgentsQuery,
} from '@/types/cotti/platformAnalytics';

import {
  buildCottiPlatformAnalyticsContainsCondition,
  cottiPlatformAnalyticsDetailQuerySchema,
  normalizeCottiPlatformAnalyticsDetailQuery,
} from './detailQuery';
import type { ResolvedCottiPlatformAnalyticsPeriod } from './range';

const DEFAULT_SORT: CottiPlatformAnalyticsAgentSort = 'totalTokens';
const TERMINAL_STATUSES = ['done', 'error', 'interrupted'] as const;

const agentSortSchema = z.enum([
  'activeUsers',
  'averageProcessingTimeMs',
  'errorExecutions',
  'executions',
  'lastExecutedAt',
  'recordedCost',
  'totalTokens',
]);

export const cottiPlatformAnalyticsAgentsQuerySchema =
  cottiPlatformAnalyticsDetailQuerySchema.extend({
    sortBy: agentSortSchema.optional(),
  });

const toFiniteNumber = (value: number | null | undefined) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};

export const getCottiPlatformAnalyticsAgents = async (
  db: LobeChatDatabase,
  period: ResolvedCottiPlatformAnalyticsPeriod,
  query?: CottiPlatformAnalyticsAgentsQuery,
): Promise<{
  items: CottiPlatformAnalyticsAgentItem[];
  page: number;
  pageSize: number;
  total: number;
}> => {
  const { page, pageSize, q, sortBy } = normalizeCottiPlatformAnalyticsDetailQuery(
    query,
    DEFAULT_SORT,
  );
  const usage = db
    .select({
      activeUsers: sql<number>`COUNT(DISTINCT ${agentOperations.userId})`
        .mapWith(Number)
        .as('active_users'),
      agentId: agentOperations.agentId,
      averageProcessingTimeMs: sql<number>`COALESCE(AVG(${agentOperations.processingTimeMs}), 0)`
        .mapWith(Number)
        .as('average_processing_time_ms'),
      costRecordedExecutions: sql<number>`COUNT(${agentOperations.totalCost})`
        .mapWith(Number)
        .as('cost_recorded_executions'),
      errorExecutions: sql<number>`COUNT(*) FILTER (WHERE ${agentOperations.status} = 'error')`
        .mapWith(Number)
        .as('error_executions'),
      executions: sql<number>`COUNT(*)`.mapWith(Number).as('executions'),
      interruptedExecutions:
        sql<number>`COUNT(*) FILTER (WHERE ${agentOperations.status} = 'interrupted')`
          .mapWith(Number)
          .as('interrupted_executions'),
      lastExecutedAt: sql<Date | null>`MAX(${agentOperations.createdAt})`
        .mapWith(agentOperations.createdAt)
        .as('last_executed_at'),
      llmCalls: sql<number>`COALESCE(SUM(${agentOperations.llmCalls}), 0)`
        .mapWith(Number)
        .as('llm_calls'),
      recordedCost: sql<number>`COALESCE(SUM(${agentOperations.totalCost}), 0)`
        .mapWith(Number)
        .as('recorded_cost'),
      tokenRecordedExecutions: sql<number>`COUNT(${agentOperations.totalTokens})`
        .mapWith(Number)
        .as('token_recorded_executions'),
      toolCalls: sql<number>`COALESCE(SUM(${agentOperations.toolCalls}), 0)`
        .mapWith(Number)
        .as('tool_calls'),
      totalInputTokens: sql<number>`COALESCE(SUM(${agentOperations.totalInputTokens}), 0)`
        .mapWith(Number)
        .as('total_input_tokens'),
      totalOutputTokens: sql<number>`COALESCE(SUM(${agentOperations.totalOutputTokens}), 0)`
        .mapWith(Number)
        .as('total_output_tokens'),
      totalTokens: sql<number>`COALESCE(SUM(${agentOperations.totalTokens}), 0)`
        .mapWith(Number)
        .as('total_tokens'),
    })
    .from(agentOperations)
    .where(
      and(
        gte(agentOperations.createdAt, period.startAtDate),
        lt(agentOperations.createdAt, period.endAtDate),
        isNull(agentOperations.parentOperationId),
        inArray(agentOperations.status, TERMINAL_STATUSES),
      ),
    )
    .groupBy(agentOperations.agentId)
    .as('cotti_platform_agent_usage');
  const searchCondition = buildCottiPlatformAnalyticsContainsCondition(agents.title, q);
  const orderBy = (() => {
    switch (sortBy) {
      case 'activeUsers': {
        return desc(usage.activeUsers);
      }
      case 'averageProcessingTimeMs': {
        return desc(usage.averageProcessingTimeMs);
      }
      case 'errorExecutions': {
        return desc(usage.errorExecutions);
      }
      case 'executions': {
        return desc(usage.executions);
      }
      case 'lastExecutedAt': {
        return sql`${usage.lastExecutedAt} DESC NULLS LAST`;
      }
      case 'recordedCost': {
        return desc(usage.recordedCost);
      }
      case 'totalTokens': {
        return desc(usage.totalTokens);
      }
    }
  })();

  const rows = await db
    .select({
      activeUsers: usage.activeUsers,
      agentId: usage.agentId,
      avatar: agents.avatar,
      averageProcessingTimeMs: usage.averageProcessingTimeMs,
      costRecordedExecutions: usage.costRecordedExecutions,
      errorExecutions: usage.errorExecutions,
      executions: usage.executions,
      interruptedExecutions: usage.interruptedExecutions,
      lastExecutedAt: usage.lastExecutedAt,
      llmCalls: usage.llmCalls,
      recordedCost: usage.recordedCost,
      title: agents.title,
      tokenRecordedExecutions: usage.tokenRecordedExecutions,
      toolCalls: usage.toolCalls,
      total: sql<number>`COUNT(*) OVER()`.mapWith(Number),
      totalInputTokens: usage.totalInputTokens,
      totalOutputTokens: usage.totalOutputTokens,
      totalTokens: usage.totalTokens,
    })
    .from(usage)
    .leftJoin(agents, eq(agents.id, usage.agentId))
    .where(searchCondition)
    .orderBy(orderBy, sql`${usage.agentId} ASC NULLS LAST`)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  let total = toFiniteNumber(rows[0]?.total);
  if (rows.length === 0 && page > 1) {
    const [totalRow] = await db
      .select({ total: sql<number>`COUNT(*)`.mapWith(Number) })
      .from(usage)
      .leftJoin(agents, eq(agents.id, usage.agentId))
      .where(searchCondition);
    total = toFiniteNumber(totalRow?.total);
  }

  return {
    items: rows.map((row) => {
      const executions = toFiniteNumber(row.executions);
      const errorExecutions = toFiniteNumber(row.errorExecutions);
      const interruptedExecutions = toFiniteNumber(row.interruptedExecutions);

      return {
        activeUsers: toFiniteNumber(row.activeUsers),
        agentId: row.agentId,
        avatar: row.avatar,
        averageProcessingTimeMs: toFiniteNumber(row.averageProcessingTimeMs),
        costRecordedExecutions: toFiniteNumber(row.costRecordedExecutions),
        errorExecutions,
        errorRate: executions > 0 ? errorExecutions / executions : 0,
        executions,
        interruptedExecutions,
        interruptionRate: executions > 0 ? interruptedExecutions / executions : 0,
        lastExecutedAt: row.lastExecutedAt?.toISOString() ?? null,
        llmCalls: toFiniteNumber(row.llmCalls),
        recordedCost: toFiniteNumber(row.recordedCost),
        title: row.title,
        tokenRecordedExecutions: toFiniteNumber(row.tokenRecordedExecutions),
        toolCalls: toFiniteNumber(row.toolCalls),
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
