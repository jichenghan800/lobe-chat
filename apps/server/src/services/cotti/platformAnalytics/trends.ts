import { and, gte, inArray, lt, sql } from 'drizzle-orm';

import { messages } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import { notCopiedTranscript } from '@/database/utils/copiedTranscript';
import type { CottiPlatformAnalyticsTrendItem } from '@/types/cotti/platformAnalytics';

import { cottiRealUserMessageCondition } from './activitySql';
import type { ResolvedCottiPlatformAnalyticsPeriod } from './range';
import { listCottiPlatformAnalyticsDays } from './range';
import { cottiMessageUsageNumber } from './usageSql';

interface TrendRow {
  activeUsers: number;
  assistantMessages: number;
  day: string;
  errorMessages: number;
  realActiveUsers: number;
  recordedCost: number;
  totalTokens: number;
  userMessages: number;
}

const toFiniteNumber = (value: number | null | undefined) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};

export const getCottiPlatformAnalyticsTrends = async (
  db: LobeChatDatabase,
  period: ResolvedCottiPlatformAnalyticsPeriod,
): Promise<CottiPlatformAnalyticsTrendItem[]> => {
  const day = sql<string>`TO_CHAR(
    ${messages.createdAt} AT TIME ZONE 'Asia/Shanghai',
    'YYYY-MM-DD'
  )`;
  const inputTokens = cottiMessageUsageNumber('totalInputTokens');
  const outputTokens = cottiMessageUsageNumber('totalOutputTokens');
  const recordedCost = cottiMessageUsageNumber('cost');

  const rows = await db
    .select({
      activeUsers:
        sql<number>`COUNT(DISTINCT ${messages.userId}) FILTER (WHERE ${messages.role} = 'user')`.mapWith(
          Number,
        ),
      assistantMessages:
        sql<number>`COUNT(*) FILTER (WHERE ${messages.role} = 'assistant')`.mapWith(Number),
      day,
      errorMessages:
        sql<number>`COUNT(*) FILTER (WHERE ${messages.role} = 'assistant' AND ${messages.error} IS NOT NULL)`.mapWith(
          Number,
        ),
      realActiveUsers:
        sql<number>`COUNT(DISTINCT ${messages.userId}) FILTER (WHERE ${cottiRealUserMessageCondition})`.mapWith(
          Number,
        ),
      recordedCost:
        sql<number>`COALESCE(SUM(${recordedCost}) FILTER (WHERE ${messages.role} = 'assistant'), 0)`.mapWith(
          Number,
        ),
      totalTokens:
        sql<number>`COALESCE(SUM(${inputTokens} + ${outputTokens}) FILTER (WHERE ${messages.role} = 'assistant'), 0)`.mapWith(
          Number,
        ),
      userMessages: sql<number>`COUNT(*) FILTER (WHERE ${messages.role} = 'user')`.mapWith(Number),
    })
    .from(messages)
    .where(
      and(
        notCopiedTranscript(),
        gte(messages.createdAt, period.startAtDate),
        lt(messages.createdAt, period.endAtDate),
        inArray(messages.role, ['assistant', 'user']),
      ),
    )
    .groupBy(day)
    .orderBy(day);

  const rowsByDay = new Map(rows.map((row) => [row.day, row as TrendRow]));

  return listCottiPlatformAnalyticsDays(period.startDate, period.endDate).map((date) => {
    const row = rowsByDay.get(date);
    const assistantMessages = toFiniteNumber(row?.assistantMessages);
    const errorMessages = toFiniteNumber(row?.errorMessages);
    const userMessages = toFiniteNumber(row?.userMessages);

    return {
      activeUsers: toFiniteNumber(row?.activeUsers),
      assistantMessages,
      day: date,
      errorMessages,
      errorRate: assistantMessages > 0 ? errorMessages / assistantMessages : 0,
      realActiveUsers: toFiniteNumber(row?.realActiveUsers),
      recordedCost: toFiniteNumber(row?.recordedCost),
      totalMessages: userMessages + assistantMessages,
      totalTokens: toFiniteNumber(row?.totalTokens),
      userMessages,
    };
  });
};
