import type { UIChatMessage } from '@lobechat/types';
import type { SQL } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { MessageModel } from '@/database/models/message';
import { cottiAuditViewLogs } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import { FileService } from '@/server/services/file';
import type {
  CottiTopicOverviewDetail,
  CottiTopicOverviewItem,
  CottiTopicOverviewList,
  CottiTopicOverviewMode,
  CottiTopicOverviewQuery,
} from '@/types/cotti/topicOverview';

const MAX_TOPIC_MESSAGES = 5000;

export const cottiTopicOverviewQuerySchema = z.object({
  status: z.enum(['active', 'frozen', 'all']).default('active'),
  page: z.number().int().min(1).max(10_000).default(1),
  pageSize: z.union([z.literal(20), z.literal(50)]).default(50),
  q: z.string().trim().max(100).optional(),
});

interface TopicOverviewRow {
  agentId: null | string;
  costRecords: number | string;
  costUsd: number | string | null;
  createdAt: Date | string;
  frozen: boolean;
  groupId: null | string;
  id: string;
  imageCount: number | string;
  messageCount: number | string;
  mode: CottiTopicOverviewMode;
  pricedRecords: number | string;
  sessionId: null | string;
  targetTitle: null | string;
  title: null | string;
  total?: number | string;
  updatedAt: Date | string;
  userEmail: null | string;
  userId: string;
  userName: null | string;
  workspaceId: null | string;
}

interface RecordTopicViewParams {
  adminEmail?: null | string;
  adminUserId: string;
  target: CottiTopicOverviewDetail;
}

const toNumber = (value: number | string | null | undefined) => Number(value || 0);
const toISOString = (value: Date | string) =>
  (value instanceof Date ? value : new Date(value)).toISOString();

/** Admin-only transcript: preserve native attachment and work cards; no TTS generation. */
export const sanitizeCottiTopicOverviewMessage = (message: UIChatMessage): UIChatMessage => ({
  ...message,
  compressedMessages: message.compressedMessages?.map(sanitizeCottiTopicOverviewMessage),
  extra: message.extra ? { ...message.extra, tts: undefined } : undefined,
  members: message.members?.map(sanitizeCottiTopicOverviewMessage),
  tasks: message.tasks?.map(sanitizeCottiTopicOverviewMessage),
});

export class CottiTopicOverviewService {
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase) {
    this.db = db;
  }

  async getDetail(topicId: string): Promise<CottiTopicOverviewDetail | undefined> {
    const result = await this.db.execute(sql`
      ${this.buildTopicRowsQuery({ topicId })}
      ${this.buildPageRowsQuery(sql`SELECT * FROM filtered_topics LIMIT 1`)}
    `);
    const row = result.rows[0] as unknown as TopicOverviewRow | undefined;
    if (!row) return;

    const item = this.mapTopicRow(row);
    const messageModel = new MessageModel(this.db, item.userId, item.workspaceId ?? undefined);
    const fileService = new FileService(this.db, item.userId, item.workspaceId ?? undefined);
    const messages = await messageModel.query(
      {
        // Request one extra slot for complete topics so MessageModel's
        // newest-page boundary alignment does not trim a leading system row.
        pageSize: Math.max(
          1,
          item.messageCount <= MAX_TOPIC_MESSAGES ? item.messageCount + 1 : MAX_TOPIC_MESSAGES,
        ),
        skipWorks: false,
        topicId: item.id,
      },
      {
        postProcessUrl: (path, file) => fileService.getFileAccessUrl({ id: file.id, url: path }),
      },
    );

    const agentRows = await this.db.execute(sql`
      SELECT id, title, name, avatar, background_color FROM agents
      WHERE id=${item.agentId ?? null} OR id IN (SELECT DISTINCT agent_id FROM messages WHERE topic_id=${item.id})
    `);
    const agentMetas = Object.fromEntries(
      agentRows.rows.map((agent) => [
        String(agent.id),
        {
          title: agent.title == null ? undefined : String(agent.title),
          name: agent.name == null ? undefined : String(agent.name),
          avatar: agent.avatar == null ? undefined : String(agent.avatar),
          backgroundColor:
            agent.background_color == null ? undefined : String(agent.background_color),
        },
      ]),
    );
    return {
      ...item,
      agentMetas,
      messages: messages.map(sanitizeCottiTopicOverviewMessage),
      messagesTruncated: item.messageCount > MAX_TOPIC_MESSAGES,
    };
  }

  async list(input?: CottiTopicOverviewQuery): Promise<CottiTopicOverviewList> {
    const query = cottiTopicOverviewQuerySchema.parse(input ?? {});
    const offset = (query.page - 1) * query.pageSize;
    const result = await this.db.execute(sql`
      ${this.buildTopicRowsQuery({ q: query.q, status: query.status })}
      ${this.buildPageRowsQuery(sql`
        SELECT *, COUNT(*) OVER() AS total
        FROM filtered_topics
        ORDER BY "costUsd" DESC NULLS LAST, "updatedAt" DESC, id DESC
        LIMIT ${query.pageSize}
        OFFSET ${offset}
      `)}
      ORDER BY "costUsd" DESC NULLS LAST, "updatedAt" DESC, id DESC
    `);
    const rows = result.rows as unknown as TopicOverviewRow[];
    // An empty out-of-range page has no window-count row; preserve the real total.
    const total = rows.length
      ? toNumber(rows[0].total)
      : toNumber(
          (
            await this.db.execute(sql`
      ${this.buildTopicRowsQuery({ q: query.q, status: query.status })}
      SELECT COUNT(*) AS total FROM filtered_topics
    `)
          ).rows[0]?.total as number | string | undefined,
        );

    return {
      items: rows.map(this.mapTopicRow),
      page: query.page,
      pageSize: query.pageSize,
      query: { q: query.q },
      total,
    };
  }

  async recordView({ adminEmail, adminUserId, target }: RecordTopicViewParams) {
    await this.db.insert(cottiAuditViewLogs).values({
      adminEmail: adminEmail ?? null,
      adminUserId,
      metadata: {
        imageCount: target.imageCount,
        messageCount: target.messageCount,
        messagesTruncated: target.messagesTruncated,
        source: 'cotti-topic-overview',
      },
      sessionId: target.sessionId ?? null,
      targetId: target.id,
      targetType: 'topic',
      targetUserEmail: target.userEmail ?? null,
      targetUserId: target.userId,
    });
  }

  private buildTopicRowsQuery = ({
    q,
    topicId,
    status,
  }: {
    q?: string;
    topicId?: string;
    status?: 'active' | 'frozen' | 'all';
  }) => {
    const normalizedQuery = q
      ?.trim()
      .toLowerCase()
      .replaceAll(/[\\%_]/g, '\\$&');

    return sql`
      WITH filtered_topics AS MATERIALIZED (
        SELECT
          topics.id,
          (topics.cost->'llm'->>'total')::numeric AS "costUsd",
          EXISTS (SELECT 1 FROM topic_cost_freezes f WHERE f.topic_id=topics.id) AS frozen,
          topics.title,
          topics.agent_id AS "agentId",
          topics.group_id AS "groupId",
          topics.session_id AS "sessionId",
          topics.workspace_id AS "workspaceId",
          topics.user_id AS "userId",
          topics.created_at AS "createdAt",
          topics.updated_at AS "updatedAt",
          users.email AS "userEmail",
          COALESCE(
            NULLIF(users.full_name, ''),
            NULLIF(users.username, ''),
            NULLIF(CONCAT_WS(' ', users.first_name, users.last_name), '')
          ) AS "userName",
          COALESCE(NULLIF(chat_groups.title, ''), NULLIF(agents.title, ''), NULLIF(sessions.title, ''))
            AS "targetTitle"
        FROM topics
        INNER JOIN users ON users.id = topics.user_id
        LEFT JOIN sessions ON sessions.id = topics.session_id
        LEFT JOIN agents ON agents.id = topics.agent_id
        LEFT JOIN chat_groups ON chat_groups.id = topics.group_id
        WHERE COALESCE(topics.is_deleted, FALSE) = FALSE
          AND (${status ?? 'all'}='all' OR EXISTS (SELECT 1 FROM topic_cost_freezes f WHERE f.topic_id=topics.id) = (${status ?? 'all'}='frozen'))
          AND (${topicId ?? null}::text IS NULL OR topics.id = ${topicId ?? null})
          AND (
            ${normalizedQuery ?? null}::text IS NULL
            OR LOWER(CONCAT_WS(
              ' ',
              topics.title,
              topics.description,
              topics.id,
              users.email,
              users.normalized_email,
              users.full_name,
              users.username,
              chat_groups.title,
              agents.title,
              sessions.title
            )) LIKE ${normalizedQuery ? `%${normalizedQuery}%` : null}
          )
      )
    `;
  };

  /** Aggregate messages and operations only for the requested page, never every matching topic. */
  private buildPageRowsQuery = (page: SQL) => sql`
    SELECT page.*,
      CASE
        WHEN operation.has_task THEN 'task'
        WHEN operation.has_operation THEN 'agent'
        ELSE 'chat'
      END AS mode,
      COALESCE(message_stats.cost_records, 0) AS "costRecords",
      COALESCE(message_stats.priced_records, 0) AS "pricedRecords",
      COALESCE(message_stats.message_count, 0) AS "messageCount",
      COALESCE(message_stats.image_count, 0) AS "imageCount"
    FROM (${page}) page
        LEFT JOIN LATERAL (
          SELECT
            COUNT(DISTINCT messages.id) AS message_count,
            COUNT(DISTINCT messages.id) FILTER (WHERE messages.role='assistant' AND messages.user_id=page."userId" AND coalesce(messages.metadata->>'copied','') <> 'true') AS cost_records,
            COUNT(DISTINCT messages.id) FILTER (WHERE messages.role='assistant' AND messages.user_id=page."userId" AND coalesce(messages.metadata->>'copied','') <> 'true' AND coalesce(messages.usage->>'cost', messages.metadata->'usage'->>'cost', messages.metadata->>'cost') ~ '^[0-9]+([.][0-9]+)?$') AS priced_records,
            COUNT(*) FILTER (WHERE files.file_type LIKE 'image/%') AS image_count
          FROM messages
          LEFT JOIN messages_files ON messages_files.message_id = messages.id
          LEFT JOIN files ON files.id = messages_files.file_id
          WHERE messages.topic_id = page.id
        ) message_stats ON TRUE
        LEFT JOIN LATERAL (
          SELECT
            BOOL_OR(agent_operations.task_id IS NOT NULL OR agent_operations.trigger = 'task')
              AS has_task,
            COUNT(*) > 0 AS has_operation
          FROM agent_operations
          WHERE agent_operations.topic_id = page.id
            AND agent_operations.parent_operation_id IS NULL
        ) operation ON TRUE
  `;

  private mapTopicRow = (row: TopicOverviewRow): CottiTopicOverviewItem => ({
    costUsd: row.costUsd == null ? null : Number(row.costUsd),
    costComplete: toNumber(row.costRecords) === toNumber(row.pricedRecords),
    frozen: row.frozen,
    agentId: row.agentId,
    createdAt: toISOString(row.createdAt),
    groupId: row.groupId,
    id: row.id,
    imageCount: toNumber(row.imageCount),
    messageCount: toNumber(row.messageCount),
    mode: row.mode,
    sessionId: row.sessionId,
    targetTitle: row.targetTitle,
    title: row.title,
    updatedAt: toISOString(row.updatedAt),
    userEmail: row.userEmail,
    userId: row.userId,
    userName: row.userName,
    workspaceId: row.workspaceId,
  });
}
