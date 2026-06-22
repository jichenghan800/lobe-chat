import { sql } from 'drizzle-orm';

import type { LobeChatDatabase } from '@/database/type';
import type {
  PlatformAnalyticsDashboard,
  PlatformAnalyticsErrorItem,
  PlatformAnalyticsFeatureItem,
  PlatformAnalyticsModelItem,
  PlatformAnalyticsOverview,
  PlatformAnalyticsQuery,
  PlatformAnalyticsRange,
  PlatformAnalyticsTrendItem,
  PlatformAnalyticsUserItem,
  PlatformFeedbackAnalytics,
  PlatformFeedbackReportItem,
  PlatformFeedbackStatus,
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

interface FeedbackOverviewRow {
  ignored: unknown;
  open: unknown;
  resolved: unknown;
  reviewing: unknown;
  total: unknown;
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

const toFeedbackStatus = (value: unknown): PlatformFeedbackStatus => {
  if (value === 'ignored' || value === 'reviewing' || value === 'resolved') return value;

  return 'open';
};

const normalizeRange = (range: PlatformAnalyticsRange) => {
  if ([1, 7, 30, 90].includes(range)) return range;

  return 1;
};

const SHANGHAI_TIMEZONE_OFFSET = 8 * 60 * 60 * 1000;

const getShanghaiRangeStart = (range: PlatformAnalyticsRange, now = new Date()) => {
  const shanghaiNow = new Date(now.getTime() + SHANGHAI_TIMEZONE_OFFSET);

  return new Date(
    Date.UTC(
      shanghaiNow.getUTCFullYear(),
      shanghaiNow.getUTCMonth(),
      shanghaiNow.getUTCDate() - range + 1,
      -8,
      0,
      0,
      0,
    ),
  );
};

const getAnalyticsBounds = (params: PlatformAnalyticsQuery) => {
  const normalizedRange = normalizeRange(params.range || 1);
  const endAt = new Date();

  if (params.customRange) {
    const startAt = new Date(params.customRange.start);
    const customEndAt = new Date(params.customRange.end);

    if (Number.isNaN(startAt.getTime()) || Number.isNaN(customEndAt.getTime())) {
      return {
        endAt,
        range: normalizedRange,
        startAt: getShanghaiRangeStart(normalizedRange, endAt),
      };
    }

    return {
      customRange: {
        end: customEndAt.toISOString(),
        start: startAt.toISOString(),
      },
      endAt: customEndAt,
      range: normalizedRange,
      startAt,
    };
  }

  return {
    endAt,
    range: normalizedRange,
    startAt: getShanghaiRangeStart(normalizedRange, endAt),
  };
};

export class PlatformAnalyticsService {
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase) {
    this.db = db;
  }

  getDashboard = async (params: PlatformAnalyticsQuery): Promise<PlatformAnalyticsDashboard> => {
    const { customRange, endAt, range: normalizedRange, startAt } = getAnalyticsBounds(params);

    const [overview, trends, topUsers, models, features, errors] = await Promise.all([
      this.getOverview(startAt, endAt),
      this.getTrends(startAt, endAt),
      this.getTopUsers(startAt, endAt),
      this.getModelUsage(startAt, endAt),
      this.getFeatureUsage(startAt, endAt),
      this.getErrors(startAt, endAt),
    ]);

    return {
      errors,
      features,
      generatedAt: endAt.toISOString(),
      models,
      overview,
      ...(customRange ? { customRange } : {}),
      range: normalizedRange,
      topUsers,
      trends,
    };
  };

  getFeedbackAnalytics = async (
    range: PlatformAnalyticsRange,
  ): Promise<PlatformFeedbackAnalytics> => {
    const normalizedRange = normalizeRange(range);
    const endAt = new Date();
    const startAt = getShanghaiRangeStart(normalizedRange, endAt);

    const [overview, items] = await Promise.all([
      this.getFeedbackOverview(startAt),
      this.getFeedbackItems(startAt),
    ]);

    return {
      generatedAt: endAt.toISOString(),
      items,
      overview,
      range: normalizedRange,
    };
  };

  private getFeedbackOverview = async (
    startAt: Date,
  ): Promise<PlatformFeedbackAnalytics['overview']> => {
    const result = await this.db.execute(sql`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'open') AS open,
        COUNT(*) FILTER (WHERE status = 'reviewing') AS reviewing,
        COUNT(*) FILTER (WHERE status = 'resolved') AS resolved,
        COUNT(*) FILTER (WHERE status = 'ignored') AS ignored
      FROM feedback_reports
      WHERE created_at >= ${startAt}
    `);

    const row = result.rows[0] as unknown as FeedbackOverviewRow | undefined;

    return {
      ignored: toNumber(row?.ignored),
      open: toNumber(row?.open),
      resolved: toNumber(row?.resolved),
      reviewing: toNumber(row?.reviewing),
      total: toNumber(row?.total),
    };
  };

  private getFeedbackItems = async (startAt: Date): Promise<PlatformFeedbackReportItem[]> => {
    const result = await this.db.execute(sql`
      SELECT
        id,
        user_id AS "userId",
        user_email AS email,
        title,
        message,
        status,
        screenshot_url AS "screenshotUrl",
        issue_url AS "issueUrl",
        client_info->>'url' AS "pageUrl",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM feedback_reports
      WHERE created_at >= ${startAt}
      ORDER BY created_at DESC
      LIMIT 100
    `);

    return result.rows.map((row) => ({
      createdAt: toIsoString(row.createdAt) || '',
      email: row.email ? toStringValue(row.email) : undefined,
      id: toStringValue(row.id),
      issueUrl: row.issueUrl ? toStringValue(row.issueUrl) : undefined,
      message: toStringValue(row.message),
      pageUrl: row.pageUrl ? toStringValue(row.pageUrl) : undefined,
      screenshotUrl: row.screenshotUrl ? toStringValue(row.screenshotUrl) : undefined,
      status: toFeedbackStatus(row.status),
      title: toStringValue(row.title),
      updatedAt: toIsoString(row.updatedAt) || '',
      userId: row.userId ? toStringValue(row.userId) : undefined,
    }));
  };

  private getOverview = async (startAt: Date, endAt: Date): Promise<PlatformAnalyticsOverview> => {
    const result = await this.db.execute(sql`
      WITH range_messages AS (
        SELECT *
        FROM messages
        WHERE created_at >= ${startAt}
          AND created_at <= ${endAt}
      )
      SELECT
        (SELECT COUNT(*) FROM users) AS "totalUsers",
        (SELECT COUNT(*) FROM users WHERE created_at >= ${startAt} AND created_at <= ${endAt}) AS "newUsers",
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
          (${startAt}::timestamptz AT TIME ZONE 'Asia/Shanghai')::date,
          (${endAt}::timestamptz AT TIME ZONE 'Asia/Shanghai')::date,
          interval '1 day'
        )::date AS day
      ),
      rollup AS (
        SELECT
          (created_at AT TIME ZONE 'Asia/Shanghai')::date AS day,
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
          AND created_at <= ${endAt}
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

  private getTopUsers = async (
    startAt: Date,
    endAt: Date,
  ): Promise<PlatformAnalyticsUserItem[]> => {
    const result = await this.db.execute(sql`
      WITH message_rollup AS (
        SELECT
          user_id,
          COALESCE(provider, 'unknown') AS provider,
          COALESCE(model, 'unknown') AS model,
          MAX(created_at) AS last_active_at,
          COUNT(DISTINCT (created_at AT TIME ZONE 'Asia/Shanghai')::date) AS active_days,
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
          AND created_at <= ${endAt}
          AND role = 'assistant'
          AND provider IS NOT NULL
          AND provider <> ''
          AND model IS NOT NULL
          AND model <> ''
        GROUP BY user_id, provider, model
      ),
      operation_rollup AS (
        SELECT
          user_id,
          COALESCE(provider, 'unknown') AS provider,
          COALESCE(model, 'unknown') AS model,
          MAX(created_at) AS last_active_at,
          COUNT(DISTINCT (created_at AT TIME ZONE 'Asia/Shanghai')::date) AS active_days,
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
          AND created_at <= ${endAt}
          AND provider IS NOT NULL
          AND provider <> ''
          AND model IS NOT NULL
          AND model <> ''
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

  private getModelUsage = async (
    startAt: Date,
    endAt: Date,
  ): Promise<PlatformAnalyticsModelItem[]> => {
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
          AND created_at <= ${endAt}
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
          AND created_at <= ${endAt}
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

  private getFeatureUsage = async (
    startAt: Date,
    endAt: Date,
  ): Promise<PlatformAnalyticsFeatureItem[]> => {
    const result = await this.db.execute(sql`
      SELECT 'chat' AS key, 'Chat 问答' AS label, COUNT(*) AS count, COUNT(DISTINCT user_id) AS users
      FROM messages
      WHERE created_at >= ${startAt} AND created_at <= ${endAt} AND role = 'assistant'
      UNION ALL
      SELECT 'search' AS key, '联网搜索' AS label, COUNT(*) AS count, COUNT(DISTINCT user_id) AS users
      FROM messages
      WHERE created_at >= ${startAt} AND created_at <= ${endAt} AND search IS NOT NULL
      UNION ALL
      SELECT 'tools' AS key, '工具调用' AS label, COUNT(*) AS count, COUNT(DISTINCT user_id) AS users
      FROM messages
      WHERE created_at >= ${startAt} AND created_at <= ${endAt} AND tools IS NOT NULL
      UNION ALL
      SELECT 'files' AS key, '文件协作' AS label, COUNT(DISTINCT messages_files.file_id) AS count, COUNT(DISTINCT messages_files.user_id) AS users
      FROM messages_files
      JOIN messages ON messages.id = messages_files.message_id
      WHERE messages.created_at >= ${startAt} AND messages.created_at <= ${endAt}
      UNION ALL
      SELECT 'image' AS key, '图片生成' AS label, COUNT(*) AS count, COUNT(DISTINCT generation_batches.user_id) AS users
      FROM generation_batches
      JOIN generation_topics ON generation_topics.id = generation_batches.generation_topic_id
      WHERE generation_batches.created_at >= ${startAt}
        AND generation_batches.created_at <= ${endAt}
        AND generation_topics.type = 'image'
      UNION ALL
      SELECT 'video' AS key, '视频生成' AS label, COUNT(*) AS count, COUNT(DISTINCT generation_batches.user_id) AS users
      FROM generation_batches
      JOIN generation_topics ON generation_topics.id = generation_batches.generation_topic_id
      WHERE generation_batches.created_at >= ${startAt}
        AND generation_batches.created_at <= ${endAt}
        AND generation_topics.type = 'video'
      UNION ALL
      SELECT 'tts' AS key, '语音合成' AS label, COUNT(*) AS count, COUNT(DISTINCT message_tts.user_id) AS users
      FROM message_tts
      JOIN messages ON messages.id = message_tts.id
      WHERE messages.created_at >= ${startAt} AND messages.created_at <= ${endAt}
      ORDER BY count DESC
    `);

    return result.rows.map((row) => ({
      activeUsers: toNumber(row.users),
      count: toNumber(row.count),
      key: toStringValue(row.key),
      label: toStringValue(row.label),
    }));
  };

  private getErrors = async (startAt: Date, endAt: Date): Promise<PlatformAnalyticsErrorItem[]> => {
    const result = await this.db.execute(sql`
      SELECT
        COALESCE(provider, 'unknown') AS provider,
        COALESCE(model, 'unknown') AS model,
        COUNT(*) AS count
      FROM messages
      WHERE created_at >= ${startAt}
        AND created_at <= ${endAt}
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
