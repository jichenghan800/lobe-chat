import { sql } from 'drizzle-orm';

import type { LobeChatDatabase } from '@/database/type';
import type {
  PlatformAnalyticsDashboard,
  PlatformAnalyticsErrorItem,
  PlatformAnalyticsFeatureItem,
  PlatformAnalyticsModelItem,
  PlatformAnalyticsOverview,
  PlatformAnalyticsRange,
  PlatformAnalyticsTrendItem,
  PlatformAnalyticsUserItem,
} from '@/types/platformAnalytics';

interface OverviewRow {
  activeUsers: unknown;
  assistantMessages: unknown;
  errorMessages: unknown;
  estimatedCost: unknown;
  newUsers: unknown;
  searchMessages: unknown;
  toolMessages: unknown;
  topics: unknown;
  totalInputTokens: unknown;
  totalOutputTokens: unknown;
  totalUsers: unknown;
  userMessages: unknown;
}

const toNumber = (value: unknown) => {
  if (value === null || value === undefined) return 0;

  return Number(value) || 0;
};

const toStringValue = (value: unknown) =>
  value === null || value === undefined ? '' : String(value);

const toIsoString = (value: unknown) => {
  if (!value) return undefined;

  return new Date(value as string | Date).toISOString();
};

const normalizeRange = (range: PlatformAnalyticsRange) => {
  if ([7, 30, 90].includes(range)) return range;

  return 30;
};

export class PlatformAnalyticsService {
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase) {
    this.db = db;
  }

  getDashboard = async (range: PlatformAnalyticsRange): Promise<PlatformAnalyticsDashboard> => {
    const normalizedRange = normalizeRange(range);
    const endAt = new Date();
    const startAt = new Date(endAt);
    startAt.setDate(endAt.getDate() - normalizedRange + 1);
    startAt.setHours(0, 0, 0, 0);

    const [overview, trends, topUsers, models, features, errors] = await Promise.all([
      this.getOverview(startAt),
      this.getTrends(startAt, endAt),
      this.getTopUsers(startAt),
      this.getModelUsage(startAt),
      this.getFeatureUsage(startAt),
      this.getErrors(startAt),
    ]);

    return {
      errors,
      features,
      generatedAt: endAt.toISOString(),
      models,
      overview,
      range: normalizedRange,
      topUsers,
      trends,
    };
  };

  private getOverview = async (startAt: Date): Promise<PlatformAnalyticsOverview> => {
    const result = await this.db.execute(sql`
      WITH range_messages AS (
        SELECT *
        FROM messages
        WHERE created_at >= ${startAt}
      )
      SELECT
        (SELECT COUNT(*) FROM users) AS "totalUsers",
        (SELECT COUNT(*) FROM users WHERE created_at >= ${startAt}) AS "newUsers",
        COUNT(DISTINCT user_id) AS "activeUsers",
        COUNT(*) FILTER (WHERE role = 'user') AS "userMessages",
        COUNT(*) FILTER (WHERE role = 'assistant') AS "assistantMessages",
        COUNT(*) FILTER (WHERE role = 'assistant' AND error IS NOT NULL) AS "errorMessages",
        COUNT(DISTINCT topic_id) FILTER (WHERE topic_id IS NOT NULL) AS "topics",
        COUNT(*) FILTER (WHERE search IS NOT NULL) AS "searchMessages",
        COUNT(*) FILTER (WHERE tools IS NOT NULL) AS "toolMessages",
        COALESCE(SUM(
          CASE
            WHEN role = 'assistant' AND metadata->>'totalInputTokens' ~ '^[0-9]+$'
              THEN (metadata->>'totalInputTokens')::int
            ELSE 0
          END
        ), 0) AS "totalInputTokens",
        COALESCE(SUM(
          CASE
            WHEN role = 'assistant' AND metadata->>'totalOutputTokens' ~ '^[0-9]+$'
              THEN (metadata->>'totalOutputTokens')::int
            ELSE 0
          END
        ), 0) AS "totalOutputTokens",
        COALESCE(SUM(
          CASE
            WHEN role = 'assistant' AND metadata->>'cost' ~ '^-?[0-9]+(\\.[0-9]+)?$'
              THEN (metadata->>'cost')::numeric
            ELSE 0
          END
        ), 0) AS "estimatedCost"
      FROM range_messages
    `);

    const row = result.rows[0] as unknown as OverviewRow | undefined;
    const assistantMessages = toNumber(row?.assistantMessages);
    const errorMessages = toNumber(row?.errorMessages);
    const estimatedCost = toNumber(row?.estimatedCost);
    const totalInputTokens = toNumber(row?.totalInputTokens);
    const totalOutputTokens = toNumber(row?.totalOutputTokens);

    return {
      activeUsers: toNumber(row?.activeUsers),
      assistantMessages,
      averageCostPerAssistantMessage: assistantMessages > 0 ? estimatedCost / assistantMessages : 0,
      errorRate: assistantMessages > 0 ? errorMessages / assistantMessages : 0,
      estimatedCost,
      newUsers: toNumber(row?.newUsers),
      searchMessages: toNumber(row?.searchMessages),
      toolMessages: toNumber(row?.toolMessages),
      topics: toNumber(row?.topics),
      totalTokens: totalInputTokens + totalOutputTokens,
      totalUsers: toNumber(row?.totalUsers),
      userMessages: toNumber(row?.userMessages),
    };
  };

  private getTrends = async (startAt: Date, endAt: Date): Promise<PlatformAnalyticsTrendItem[]> => {
    const result = await this.db.execute(sql`
      WITH days AS (
        SELECT generate_series(
          date_trunc('day', ${startAt}::timestamptz),
          date_trunc('day', ${endAt}::timestamptz),
          interval '1 day'
        ) AS day
      ),
      rollup AS (
        SELECT
          date_trunc('day', created_at) AS day,
          COUNT(DISTINCT user_id) AS active_users,
          COUNT(*) AS total_messages,
          COUNT(*) FILTER (WHERE role = 'user') AS user_messages,
          COUNT(*) FILTER (WHERE role = 'assistant') AS assistant_messages,
          COALESCE(SUM(
            CASE
              WHEN role = 'assistant' AND metadata->>'totalInputTokens' ~ '^[0-9]+$'
                THEN (metadata->>'totalInputTokens')::int
              ELSE 0
            END
          ), 0) + COALESCE(SUM(
            CASE
              WHEN role = 'assistant' AND metadata->>'totalOutputTokens' ~ '^[0-9]+$'
                THEN (metadata->>'totalOutputTokens')::int
              ELSE 0
            END
          ), 0) AS total_tokens,
          COALESCE(SUM(
            CASE
              WHEN role = 'assistant' AND metadata->>'cost' ~ '^-?[0-9]+(\\.[0-9]+)?$'
                THEN (metadata->>'cost')::numeric
              ELSE 0
            END
          ), 0) AS estimated_cost
        FROM messages
        WHERE created_at >= ${startAt}
        GROUP BY 1
      )
      SELECT
        to_char(days.day, 'YYYY-MM-DD') AS day,
        COALESCE(rollup.active_users, 0) AS "activeUsers",
        COALESCE(rollup.total_messages, 0) AS "totalMessages",
        COALESCE(rollup.user_messages, 0) AS "userMessages",
        COALESCE(rollup.assistant_messages, 0) AS "assistantMessages",
        COALESCE(rollup.total_tokens, 0) AS "totalTokens",
        COALESCE(rollup.estimated_cost, 0) AS "estimatedCost"
      FROM days
      LEFT JOIN rollup ON rollup.day = days.day
      ORDER BY days.day ASC
    `);

    return result.rows.map((row) => ({
      activeUsers: toNumber(row.activeUsers),
      assistantMessages: toNumber(row.assistantMessages),
      day: toStringValue(row.day),
      estimatedCost: toNumber(row.estimatedCost),
      totalMessages: toNumber(row.totalMessages),
      totalTokens: toNumber(row.totalTokens),
      userMessages: toNumber(row.userMessages),
    }));
  };

  private getTopUsers = async (startAt: Date): Promise<PlatformAnalyticsUserItem[]> => {
    const result = await this.db.execute(sql`
      WITH message_rollup AS (
        SELECT
          user_id,
          COALESCE(provider, 'unknown') AS provider,
          COALESCE(model, 'unknown') AS model,
          MAX(created_at) AS last_active_at,
          COUNT(DISTINCT date_trunc('day', created_at)) AS active_days,
          COUNT(*) AS total_messages,
          COUNT(*) FILTER (WHERE role = 'user') AS user_messages,
          COUNT(*) FILTER (WHERE role = 'assistant') AS assistant_messages,
          COUNT(*) FILTER (WHERE role = 'assistant' AND error IS NOT NULL) AS error_messages,
          COALESCE(SUM(
            CASE
              WHEN role = 'assistant' AND metadata->>'totalInputTokens' ~ '^[0-9]+$'
                THEN (metadata->>'totalInputTokens')::int
              ELSE 0
            END
          ), 0) + COALESCE(SUM(
            CASE
              WHEN role = 'assistant' AND metadata->>'totalOutputTokens' ~ '^[0-9]+$'
                THEN (metadata->>'totalOutputTokens')::int
              ELSE 0
            END
          ), 0) AS total_tokens,
          COALESCE(SUM(
            CASE
              WHEN role = 'assistant' AND metadata->>'cost' ~ '^-?[0-9]+(\\.[0-9]+)?$'
                THEN (metadata->>'cost')::numeric
              ELSE 0
            END
          ), 0) AS estimated_cost
        FROM messages
        WHERE created_at >= ${startAt}
        GROUP BY user_id, provider, model
      ),
      operation_rollup AS (
        SELECT
          user_id,
          COALESCE(provider, 'unknown') AS provider,
          COALESCE(model, 'unknown') AS model,
          MAX(created_at) AS last_active_at,
          COUNT(DISTINCT date_trunc('day', created_at)) AS active_days,
          COUNT(*) AS request_count,
          COUNT(*) FILTER (
            WHERE status = 'error'
              OR completion_reason = 'error'
              OR error IS NOT NULL
          ) AS error_messages,
          COALESCE(SUM(total_tokens), 0) AS total_tokens,
          COALESCE(SUM(total_cost), 0) AS estimated_cost,
          COALESCE(AVG(processing_time_ms), 0) AS average_latency_ms
        FROM agent_operations
        WHERE created_at >= ${startAt}
        GROUP BY user_id, provider, model
      ),
      combined AS (
        SELECT
          COALESCE(message_rollup.user_id, operation_rollup.user_id) AS user_id,
          COALESCE(message_rollup.provider, operation_rollup.provider, 'unknown') AS provider,
          COALESCE(message_rollup.model, operation_rollup.model, 'unknown') AS model,
          GREATEST(
            COALESCE(message_rollup.last_active_at, 'epoch'::timestamptz),
            COALESCE(operation_rollup.last_active_at, 'epoch'::timestamptz)
          ) AS last_active_at,
          GREATEST(
            COALESCE(message_rollup.active_days, 0),
            COALESCE(operation_rollup.active_days, 0)
          ) AS active_days,
          COALESCE(message_rollup.total_messages, 0) AS total_messages,
          COALESCE(message_rollup.user_messages, 0) AS user_messages,
          COALESCE(message_rollup.assistant_messages, 0) AS assistant_messages,
          GREATEST(
            COALESCE(message_rollup.assistant_messages, 0),
            COALESCE(operation_rollup.request_count, 0)
          ) AS request_count,
          GREATEST(
            COALESCE(message_rollup.error_messages, 0),
            COALESCE(operation_rollup.error_messages, 0)
          ) AS error_messages,
          GREATEST(
            COALESCE(message_rollup.total_tokens, 0),
            COALESCE(operation_rollup.total_tokens, 0)
          ) AS total_tokens,
          GREATEST(
            COALESCE(message_rollup.estimated_cost, 0),
            COALESCE(operation_rollup.estimated_cost, 0)
          ) AS estimated_cost,
          COALESCE(operation_rollup.average_latency_ms, 0) AS average_latency_ms
        FROM message_rollup
        FULL OUTER JOIN operation_rollup
          ON message_rollup.user_id = operation_rollup.user_id
          AND message_rollup.provider = operation_rollup.provider
          AND message_rollup.model = operation_rollup.model
      )
      SELECT
        users.id AS "userId",
        users.email AS "userEmail",
        COALESCE(users.full_name, users.username, users.email, users.id) AS "userName",
        combined.provider,
        combined.model,
        combined.last_active_at AS "lastActiveAt",
        combined.active_days AS "activeDays",
        combined.total_messages AS "totalMessages",
        combined.user_messages AS "userMessages",
        combined.assistant_messages AS "assistantMessages",
        combined.request_count AS "requestCount",
        combined.error_messages AS "errorMessages",
        combined.total_tokens AS "totalTokens",
        combined.estimated_cost AS "estimatedCost",
        combined.average_latency_ms AS "averageLatencyMs"
      FROM combined
      JOIN users ON users.id = combined.user_id
      ORDER BY combined.total_tokens DESC, combined.request_count DESC
      LIMIT 30
    `);

    return result.rows.map((row) => ({
      activeDays: toNumber(row.activeDays),
      assistantMessages: toNumber(row.assistantMessages),
      averageLatencyMs: toNumber(row.averageLatencyMs),
      errorMessages: toNumber(row.errorMessages),
      estimatedCost: toNumber(row.estimatedCost),
      lastActiveAt: toIsoString(row.lastActiveAt),
      model: row.model ? toStringValue(row.model) : undefined,
      provider: row.provider ? toStringValue(row.provider) : undefined,
      requestCount: toNumber(row.requestCount),
      totalMessages: toNumber(row.totalMessages),
      totalTokens: toNumber(row.totalTokens),
      userEmail: row.userEmail ? toStringValue(row.userEmail) : undefined,
      userId: toStringValue(row.userId),
      userMessages: toNumber(row.userMessages),
      userName: row.userName ? toStringValue(row.userName) : undefined,
    }));
  };

  private getModelUsage = async (startAt: Date): Promise<PlatformAnalyticsModelItem[]> => {
    const result = await this.db.execute(sql`
      WITH message_rollup AS (
        SELECT
          COALESCE(provider, 'unknown') AS provider,
          COALESCE(model, 'unknown') AS model,
          COUNT(*) AS "assistantMessages",
          COUNT(DISTINCT user_id) AS "activeUsers",
          COUNT(*) FILTER (WHERE error IS NOT NULL) AS "errorMessages",
          COALESCE(SUM(
            CASE
              WHEN metadata->>'totalInputTokens' ~ '^[0-9]+$'
                THEN (metadata->>'totalInputTokens')::int
              ELSE 0
            END
          ), 0) AS "totalInputTokens",
          COALESCE(SUM(
            CASE
              WHEN metadata->>'totalOutputTokens' ~ '^[0-9]+$'
                THEN (metadata->>'totalOutputTokens')::int
              ELSE 0
            END
          ), 0) AS "totalOutputTokens",
          COALESCE(SUM(
            CASE
              WHEN metadata->>'cost' ~ '^-?[0-9]+(\\.[0-9]+)?$'
                THEN (metadata->>'cost')::numeric
              ELSE 0
            END
          ), 0) AS "estimatedCost"
        FROM messages
        WHERE created_at >= ${startAt}
          AND role = 'assistant'
        GROUP BY provider, model
      ),
      operation_rollup AS (
        SELECT
          COALESCE(provider, 'unknown') AS provider,
          COALESCE(model, 'unknown') AS model,
          COUNT(*) AS "requestCount",
          COUNT(DISTINCT user_id) AS "activeUsers",
          COALESCE(SUM(llm_calls), 0) AS "llmCalls",
          COUNT(*) FILTER (
            WHERE status = 'error'
              OR completion_reason = 'error'
              OR error IS NOT NULL
          ) AS "errorMessages",
          COALESCE(SUM(total_input_tokens), 0) AS "totalInputTokens",
          COALESCE(SUM(total_output_tokens), 0) AS "totalOutputTokens",
          COALESCE(SUM(total_cost), 0) AS "estimatedCost",
          COALESCE(AVG(processing_time_ms), 0) AS "averageLatencyMs",
          COALESCE(
            percentile_cont(0.95) WITHIN GROUP (ORDER BY processing_time_ms)
              FILTER (WHERE processing_time_ms IS NOT NULL),
            0
          ) AS "p95LatencyMs"
        FROM agent_operations
        WHERE created_at >= ${startAt}
        GROUP BY provider, model
      ),
      combined AS (
        SELECT
          COALESCE(message_rollup.provider, operation_rollup.provider, 'unknown') AS provider,
          COALESCE(message_rollup.model, operation_rollup.model, 'unknown') AS model,
          COALESCE(message_rollup."assistantMessages", 0) AS "assistantMessages",
          GREATEST(
            COALESCE(message_rollup."activeUsers", 0),
            COALESCE(operation_rollup."activeUsers", 0)
          ) AS "activeUsers",
          GREATEST(
            COALESCE(message_rollup."assistantMessages", 0),
            COALESCE(operation_rollup."requestCount", 0)
          ) AS "requestCount",
          COALESCE(operation_rollup."llmCalls", COALESCE(message_rollup."assistantMessages", 0)) AS "llmCalls",
          GREATEST(
            COALESCE(message_rollup."errorMessages", 0),
            COALESCE(operation_rollup."errorMessages", 0)
          ) AS "errorMessages",
          GREATEST(
            COALESCE(message_rollup."totalInputTokens", 0),
            COALESCE(operation_rollup."totalInputTokens", 0)
          ) AS "totalInputTokens",
          GREATEST(
            COALESCE(message_rollup."totalOutputTokens", 0),
            COALESCE(operation_rollup."totalOutputTokens", 0)
          ) AS "totalOutputTokens",
          GREATEST(
            COALESCE(message_rollup."estimatedCost", 0),
            COALESCE(operation_rollup."estimatedCost", 0)
          ) AS "estimatedCost",
          COALESCE(operation_rollup."averageLatencyMs", 0) AS "averageLatencyMs",
          COALESCE(operation_rollup."p95LatencyMs", 0) AS "p95LatencyMs"
        FROM message_rollup
        FULL OUTER JOIN operation_rollup
          ON message_rollup.provider = operation_rollup.provider
          AND message_rollup.model = operation_rollup.model
      )
      SELECT *
      FROM combined
      ORDER BY ("totalInputTokens" + "totalOutputTokens") DESC, "requestCount" DESC
      LIMIT 12
    `);

    return result.rows.map((row) => {
      const totalInputTokens = toNumber(row.totalInputTokens);
      const totalOutputTokens = toNumber(row.totalOutputTokens);
      const requestCount = toNumber(row.requestCount);
      const errorMessages = toNumber(row.errorMessages);

      return {
        activeUsers: toNumber(row.activeUsers),
        assistantMessages: toNumber(row.assistantMessages),
        averageLatencyMs: toNumber(row.averageLatencyMs),
        errorMessages,
        errorRate: requestCount > 0 ? errorMessages / requestCount : 0,
        estimatedCost: toNumber(row.estimatedCost),
        llmCalls: toNumber(row.llmCalls),
        model: toStringValue(row.model),
        p95LatencyMs: toNumber(row.p95LatencyMs),
        provider: toStringValue(row.provider),
        requestCount,
        totalInputTokens,
        totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
      };
    });
  };

  private getFeatureUsage = async (startAt: Date): Promise<PlatformAnalyticsFeatureItem[]> => {
    const result = await this.db.execute(sql`
      SELECT 'chat' AS key, 'Chat 问答' AS label, COUNT(*) AS count, COUNT(DISTINCT user_id) AS users
      FROM messages
      WHERE created_at >= ${startAt} AND role = 'assistant'
      UNION ALL
      SELECT 'search' AS key, '联网搜索' AS label, COUNT(*) AS count, COUNT(DISTINCT user_id) AS users
      FROM messages
      WHERE created_at >= ${startAt} AND search IS NOT NULL
      UNION ALL
      SELECT 'tools' AS key, '工具调用' AS label, COUNT(*) AS count, COUNT(DISTINCT user_id) AS users
      FROM messages
      WHERE created_at >= ${startAt} AND tools IS NOT NULL
      UNION ALL
      SELECT 'files' AS key, '文件协作' AS label, COUNT(DISTINCT messages_files.file_id) AS count, COUNT(DISTINCT messages_files.user_id) AS users
      FROM messages_files
      JOIN messages ON messages.id = messages_files.message_id
      WHERE messages.created_at >= ${startAt}
      UNION ALL
      SELECT 'image' AS key, '图片生成' AS label, COUNT(*) AS count, COUNT(DISTINCT generation_batches.user_id) AS users
      FROM generation_batches
      JOIN generation_topics ON generation_topics.id = generation_batches.generation_topic_id
      WHERE generation_batches.created_at >= ${startAt} AND generation_topics.type = 'image'
      UNION ALL
      SELECT 'video' AS key, '视频生成' AS label, COUNT(*) AS count, COUNT(DISTINCT generation_batches.user_id) AS users
      FROM generation_batches
      JOIN generation_topics ON generation_topics.id = generation_batches.generation_topic_id
      WHERE generation_batches.created_at >= ${startAt} AND generation_topics.type = 'video'
      UNION ALL
      SELECT 'tts' AS key, '语音合成' AS label, COUNT(*) AS count, COUNT(DISTINCT message_tts.user_id) AS users
      FROM message_tts
      JOIN messages ON messages.id = message_tts.id
      WHERE messages.created_at >= ${startAt}
      ORDER BY count DESC
    `);

    return result.rows.map((row) => ({
      activeUsers: toNumber(row.users),
      count: toNumber(row.count),
      key: toStringValue(row.key),
      label: toStringValue(row.label),
    }));
  };

  private getErrors = async (startAt: Date): Promise<PlatformAnalyticsErrorItem[]> => {
    const result = await this.db.execute(sql`
      SELECT
        COALESCE(provider, 'unknown') AS provider,
        COALESCE(model, 'unknown') AS model,
        COUNT(*) AS count
      FROM messages
      WHERE created_at >= ${startAt}
        AND role = 'assistant'
        AND error IS NOT NULL
      GROUP BY provider, model
      ORDER BY count DESC
      LIMIT 8
    `);

    return result.rows.map((row) => ({
      count: toNumber(row.count),
      model: toStringValue(row.model),
      provider: toStringValue(row.provider),
    }));
  };
}
