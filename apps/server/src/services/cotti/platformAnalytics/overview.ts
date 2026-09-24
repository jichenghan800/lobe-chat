import { and, gte, inArray, lt, sql } from 'drizzle-orm';

import { messages, users } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import { notCopiedTranscript } from '@/database/utils/copiedTranscript';
import type { CottiPlatformAnalyticsOverview } from '@/types/cotti/platformAnalytics';

import { cottiRealUserMessageCondition } from './activitySql';
import type { ResolvedCottiPlatformAnalyticsPeriod } from './range';
import { cottiMessageUsageNumber } from './usageSql';

const toFiniteNumber = (value: number | null | undefined) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};

export const getCottiPlatformAnalyticsOverview = async (
  db: LobeChatDatabase,
  period: ResolvedCottiPlatformAnalyticsPeriod,
): Promise<CottiPlatformAnalyticsOverview> => {
  const inputTokens = cottiMessageUsageNumber('totalInputTokens');
  const outputTokens = cottiMessageUsageNumber('totalOutputTokens');
  const recordedCost = cottiMessageUsageNumber('cost');

  const [[userRow], [messageRow]] = await Promise.all([
    db
      .select({
        newUsers:
          sql<number>`COUNT(*) FILTER (WHERE ${users.createdAt} >= ${period.startAtDate} AND ${users.createdAt} < ${period.endAtDate})`.mapWith(
            Number,
          ),
        totalUsers:
          sql<number>`COUNT(*) FILTER (WHERE ${users.createdAt} < ${period.endAtDate})`.mapWith(
            Number,
          ),
      })
      .from(users),
    db
      .select({
        activeTopics:
          sql<number>`COUNT(DISTINCT ${messages.topicId}) FILTER (WHERE ${messages.topicId} IS NOT NULL)`.mapWith(
            Number,
          ),
        activeUsers:
          sql<number>`COUNT(DISTINCT ${messages.userId}) FILTER (WHERE ${messages.role} = 'user')`.mapWith(
            Number,
          ),
        realActiveUsers:
          sql<number>`COUNT(DISTINCT ${messages.userId}) FILTER (WHERE ${cottiRealUserMessageCondition})`.mapWith(
            Number,
          ),
        assistantMessages:
          sql<number>`COUNT(*) FILTER (WHERE ${messages.role} = 'assistant')`.mapWith(Number),
        errorMessages:
          sql<number>`COUNT(*) FILTER (WHERE ${messages.role} = 'assistant' AND ${messages.error} IS NOT NULL)`.mapWith(
            Number,
          ),
        recordedCost:
          sql<number>`COALESCE(SUM(${recordedCost}) FILTER (WHERE ${messages.role} = 'assistant'), 0)`.mapWith(
            Number,
          ),
        totalInputTokens:
          sql<number>`COALESCE(SUM(${inputTokens}) FILTER (WHERE ${messages.role} = 'assistant'), 0)`.mapWith(
            Number,
          ),
        totalOutputTokens:
          sql<number>`COALESCE(SUM(${outputTokens}) FILTER (WHERE ${messages.role} = 'assistant'), 0)`.mapWith(
            Number,
          ),
        userMessages: sql<number>`COUNT(*) FILTER (WHERE ${messages.role} = 'user')`.mapWith(
          Number,
        ),
      })
      .from(messages)
      .where(
        and(
          notCopiedTranscript(),
          gte(messages.createdAt, period.startAtDate),
          lt(messages.createdAt, period.endAtDate),
          inArray(messages.role, ['assistant', 'user']),
        ),
      ),
  ]);

  const assistantMessages = toFiniteNumber(messageRow?.assistantMessages);
  const errorMessages = toFiniteNumber(messageRow?.errorMessages);
  const totalInputTokens = toFiniteNumber(messageRow?.totalInputTokens);
  const totalOutputTokens = toFiniteNumber(messageRow?.totalOutputTokens);
  const cost = toFiniteNumber(messageRow?.recordedCost);

  return {
    activeTopics: toFiniteNumber(messageRow?.activeTopics),
    activeUsers: toFiniteNumber(messageRow?.activeUsers),
    assistantMessages,
    averageCostPerAssistantMessage: assistantMessages > 0 ? cost / assistantMessages : 0,
    errorMessages,
    errorRate: assistantMessages > 0 ? errorMessages / assistantMessages : 0,
    newUsers: toFiniteNumber(userRow?.newUsers),
    realActiveUsers: toFiniteNumber(messageRow?.realActiveUsers),
    recordedCost: cost,
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    totalUsers: toFiniteNumber(userRow?.totalUsers),
    userMessages: toFiniteNumber(messageRow?.userMessages),
  };
};
