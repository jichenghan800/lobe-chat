import { consumeStreamUntilDone } from '@lobechat/model-runtime';
import type { SQL } from 'drizzle-orm';
import { eq, ne, sql } from 'drizzle-orm';
import { z } from 'zod';

import { cottiAuditRiskAnalyses, cottiAuditViewLogs } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import { initModelRuntimeFromDB } from '@/server/modules/ModelRuntime';
import type {
  CottiPlatformAuditAttachment,
  CottiPlatformAuditDashboard,
  CottiPlatformAuditDetail,
  CottiPlatformAuditMode,
  CottiPlatformAuditQuery,
  CottiPlatformAuditRiskAnalysis,
  CottiPlatformAuditRiskLevel,
} from '@/types/cotti/platformAudit';

import { resolveCottiPlatformAnalyticsPeriod } from '../platformAnalytics/range';
import type { CottiPlatformAuditAnalysisRow, CottiPlatformAuditRuleSignals } from './risk';
import {
  buildCottiPlatformAuditAnalysisFlags,
  buildCottiPlatformAuditReviewText,
  buildCottiPlatformAuditRuleAnalysis,
  buildCottiPlatformAuditRuleFlags,
  COTTI_AUDIT_CONFIDENTIAL_RISK_PATTERN,
  COTTI_AUDIT_CREDENTIAL_RISK_PATTERN,
  COTTI_AUDIT_PERSONAL_RISK_PATTERN,
  COTTI_AUDIT_SENSITIVE_OPERATION_RISK_PATTERN,
  detectCottiPlatformAuditRiskFlags,
  getCottiPlatformAuditRiskLevel,
  normalizeCottiPlatformAuditAnalysis,
  normalizeCottiPlatformAuditRiskLevel,
  parseCottiPlatformAuditModelAnalysis,
} from './risk';

const COTTI_PLATFORM_AUDIT_PAGE_SIZES = [20, 50] as const;
const MAX_ANALYSIS_CONTENT_LENGTH = 12_000;
const MODEL_ANALYSIS_TIMEOUT_MS = 45_000;

export const cottiPlatformAuditQuerySchema = z.object({
  feature: z.enum(['all', 'agent', 'chat', 'search', 'task', 'tool']).default('all'),
  page: z.number().int().min(1).max(10_000).default(1),
  pageSize: z.union([z.literal(20), z.literal(50)]).default(20),
  q: z.string().trim().max(100).optional(),
  range: z.union([z.literal(1), z.literal(7), z.literal(30), z.literal(90)]).default(7),
  riskLevel: z.enum(['all', 'flagged', 'none', 'low', 'medium', 'high']).default('flagged'),
});

interface PlatformAuditMessageRow extends CottiPlatformAuditAnalysisRow {
  agentId: null | string;
  attachmentRisk?: boolean;
  attachments?: CottiPlatformAuditAttachment[] | null | string;
  confidentialRisk?: boolean;
  content?: null | string;
  contentPreview?: null | string;
  createdAt: Date | string;
  credentialRisk?: boolean;
  fileCount: number | string;
  id: string;
  mode: CottiPlatformAuditMode;
  model: null | string;
  personalRisk?: boolean;
  provider: null | string;
  riskLevel?: CottiPlatformAuditRiskLevel | string;
  search: boolean;
  sensitiveOperationRisk?: boolean;
  sessionId: null | string;
  sessionTitle: null | string;
  tool: boolean;
  userEmail: null | string;
  userId: string;
  userName: null | string;
}

interface PlatformAuditSummaryRow {
  agentMessages: number | string;
  attachmentMessages: number | string;
  chatMessages: number | string;
  highRiskMessages: number | string;
  searchMessages: number | string;
  taskMessages: number | string;
  toolMessages: number | string;
  totalMessages: number | string;
}

interface AnalyzeMessageParams {
  adminEmail?: null | string;
  adminUserId: string;
  force?: boolean;
  messageId: string;
}

interface RecordMessageViewParams {
  adminEmail?: null | string;
  adminUserId: string;
  metadata?: Record<string, unknown>;
  target: CottiPlatformAuditDetail;
}

const toNumber = (value: number | string | null | undefined) => Number(value || 0);
const toDate = (value: Date | string) => (value instanceof Date ? value : new Date(value));

export const parseCottiPlatformAuditExcludedEmails = (
  adminRaw = process.env.COTTI_PLATFORM_ANALYTICS_ADMIN_EMAILS,
  authAllowedRaw = process.env.AUTH_ALLOWED_EMAILS,
) =>
  [adminRaw, authAllowedRaw]
    .flatMap((raw) => (raw || '').split(/[,;\n]/))
    .map((email) => email.trim().toLowerCase())
    .filter((email, index, values) => email.includes('@') && values.indexOf(email) === index);

/**
 * Keep every platform-wide content surface on the same audited-user scope.
 * The surrounding query must expose the subject account as the `users` table.
 */
export const buildCottiPlatformAuditedUserCondition = (subjectUserId: SQL) => {
  const environmentEmails = parseCottiPlatformAuditExcludedEmails();
  const environmentEmailCondition =
    environmentEmails.length > 0
      ? sql`LOWER(COALESCE(NULLIF(users.normalized_email, ''), NULLIF(users.email, ''), '')) IN (${sql.join(
          environmentEmails.map((email) => sql`${email}`),
          sql`, `,
        )})`
      : sql`FALSE`;

  return sql`NOT (
    ${environmentEmailCondition}
    OR COALESCE(users.role, '') = 'admin'
    OR EXISTS (
      SELECT 1
      FROM cotti_platform_admin_assignments admin_assignment
      WHERE admin_assignment.user_id = ${subjectUserId}
    )
    OR EXISTS (
      SELECT 1
      FROM rbac_user_roles user_role
      INNER JOIN rbac_roles role ON role.id = user_role.role_id
      WHERE user_role.user_id = ${subjectUserId}
        AND user_role.workspace_id IS NULL
        AND role.workspace_id IS NULL
        AND role.name = 'super_admin'
        AND role.is_active = TRUE
        AND (user_role.expires_at IS NULL OR user_role.expires_at > NOW())
    )
    OR EXISTS (
      SELECT 1
      FROM cotti_login_access_rules login_rule
      WHERE login_rule.enabled = TRUE
        AND login_rule.type = 'email'
        AND login_rule.value = LOWER(COALESCE(NULLIF(users.normalized_email, ''), NULLIF(users.email, ''), ''))
    )
  )`;
};

const normalizeAttachments = (
  value: CottiPlatformAuditAttachment[] | null | string | undefined,
): CottiPlatformAuditAttachment[] => {
  const attachments =
    typeof value === 'string'
      ? (() => {
          try {
            return JSON.parse(value) as unknown;
          } catch {
            return [];
          }
        })()
      : value;

  if (!Array.isArray(attachments)) return [];

  return attachments.flatMap((attachment) => {
    if (!attachment || typeof attachment !== 'object') return [];
    const candidate = attachment as Partial<CottiPlatformAuditAttachment>;
    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.name !== 'string' ||
      typeof candidate.fileType !== 'string'
    ) {
      return [];
    }

    return [
      {
        documentId: typeof candidate.documentId === 'string' ? candidate.documentId : null,
        documentTitle: typeof candidate.documentTitle === 'string' ? candidate.documentTitle : null,
        extractedTextPreview:
          typeof candidate.extractedTextPreview === 'string'
            ? candidate.extractedTextPreview
            : null,
        fileType: candidate.fileType,
        id: candidate.id,
        name: candidate.name,
        size: toNumber(candidate.size),
      },
    ];
  });
};

const auditRiskModelProvider = process.env.COTTI_AUDIT_RISK_MODEL_PROVIDER?.trim();
const auditRiskModel = process.env.COTTI_AUDIT_RISK_MODEL?.trim();

export class CottiPlatformAuditService {
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase) {
    this.db = db;
  }

  async analyzeMessageRisk({
    adminEmail,
    adminUserId,
    force,
    messageId,
  }: AnalyzeMessageParams): Promise<CottiPlatformAuditRiskAnalysis> {
    const detail = await this.getMessageDetail(messageId);
    if (!detail) throw new Error('Audit message not found');

    if (!force) {
      const existing = await this.getRiskAnalysis(messageId);
      if (existing?.status === 'completed') return existing;
    }

    const runningAnalysis: CottiPlatformAuditRiskAnalysis = {
      confidence: null,
      error: null,
      evidence: [],
      model: auditRiskModel ?? 'rule-based',
      provider: auditRiskModelProvider ?? 'local',
      reason: null,
      riskLabels: detail.riskFlags.map((flag) => flag.label),
      riskLevel: detail.riskLevel,
      status: 'running',
      summary: null,
    };
    const claimed = await this.claimRiskAnalysis({
      adminEmail,
      adminUserId,
      analysis: runningAnalysis,
      target: detail,
    });
    if (!claimed) {
      const inFlight = await this.getRiskAnalysis(messageId);
      if (inFlight) return inFlight;
      throw new Error('Unable to claim audit risk analysis');
    }

    let analysis: CottiPlatformAuditRiskAnalysis;
    if (!auditRiskModelProvider || !auditRiskModel) {
      analysis = buildCottiPlatformAuditRuleAnalysis(detail);
    } else {
      try {
        analysis = await this.analyzeWithModel(detail, adminUserId);
      } catch (error) {
        analysis = {
          confidence: null,
          error: error instanceof Error ? error.message : String(error),
          evidence: [],
          model: auditRiskModel,
          provider: auditRiskModelProvider,
          reason: null,
          riskLabels: detail.riskFlags.map((flag) => flag.label),
          riskLevel: detail.riskLevel,
          status: 'failed',
          summary: null,
        };
      }
    }

    await this.upsertRiskAnalysis({ adminEmail, adminUserId, analysis, target: detail });

    return analysis;
  }

  async getDashboard(input?: CottiPlatformAuditQuery): Promise<CottiPlatformAuditDashboard> {
    const query = cottiPlatformAuditQuerySchema.parse(input ?? {});
    const endAt = new Date();
    const period = resolveCottiPlatformAnalyticsPeriod(
      { days: query.range, type: 'preset' },
      endAt,
    );
    const startAt = period.startAtDate;
    const q = query.q?.trim().toLowerCase();
    const offset = (query.page - 1) * query.pageSize;
    const filteredMessages = this.buildFilteredMessagesQuery({ endAt, q, query, startAt });

    const [summaryResult, itemsResult] = await Promise.all([
      this.db.execute(sql`
        ${filteredMessages}
        SELECT
          COUNT(*) AS "totalMessages",
          COUNT(*) FILTER (WHERE "riskLevel" = 'high') AS "highRiskMessages",
          COUNT(*) FILTER (WHERE mode = 'chat') AS "chatMessages",
          COUNT(*) FILTER (WHERE mode = 'agent') AS "agentMessages",
          COUNT(*) FILTER (WHERE mode = 'task') AS "taskMessages",
          COUNT(*) FILTER (WHERE tool) AS "toolMessages",
          COUNT(*) FILTER (WHERE search) AS "searchMessages",
          COUNT(*) FILTER (WHERE "fileCount" > 0) AS "attachmentMessages"
        FROM filtered
      `),
      this.db.execute(sql`
        ${filteredMessages}
        SELECT
          id,
          provider,
          model,
          mode,
          tool,
          search,
          "agentId",
          "sessionId",
          "userId",
          "createdAt",
          "userEmail",
          "userName",
          "sessionTitle",
          "fileCount",
          "attachmentRisk",
          "credentialRisk",
          "confidentialRisk",
          "personalRisk",
          "sensitiveOperationRisk",
          "riskLevel",
          "analysisStatus",
          "analysisSummary",
          "analysisReason",
          "analysisConfidence",
          "analysisEvidence",
          "analysisRiskLevel",
          "analysisRiskLabels",
          "analysisProvider",
          "analysisModel",
          "analysisError",
          "analysisUpdatedAt"
        FROM filtered
        ORDER BY "createdAt" DESC, id DESC
        LIMIT ${query.pageSize}
        OFFSET ${offset}
      `),
    ]);

    const summary = summaryResult.rows[0] as unknown as PlatformAuditSummaryRow | undefined;
    const total = toNumber(summary?.totalMessages);

    return {
      items: itemsResult.rows.map((row) =>
        this.mapMessageRow(row as unknown as PlatformAuditMessageRow, false),
      ),
      overview: {
        agentMessages: toNumber(summary?.agentMessages),
        attachmentMessages: toNumber(summary?.attachmentMessages),
        chatMessages: toNumber(summary?.chatMessages),
        highRiskMessages: toNumber(summary?.highRiskMessages),
        searchMessages: toNumber(summary?.searchMessages),
        taskMessages: toNumber(summary?.taskMessages),
        toolMessages: toNumber(summary?.toolMessages),
        totalMessages: total,
      },
      page: query.page,
      pageSize: query.pageSize,
      query: {
        feature: query.feature,
        page: query.page,
        pageSize: query.pageSize,
        q: query.q,
        range: query.range,
        riskLevel: query.riskLevel,
      },
      total,
    };
  }

  async getMessageDetail(messageId: string): Promise<CottiPlatformAuditDetail | undefined> {
    const result = await this.db.execute(sql`
      SELECT
        messages.id,
        messages.content,
        LEFT(COALESCE(messages.content, ''), 160) AS "contentPreview",
        COALESCE(NULLIF(operation.provider, ''), reply_stats.provider, messages.provider) AS provider,
        COALESCE(NULLIF(operation.model, ''), reply_stats.model, messages.model) AS model,
        CASE
          WHEN operation.trigger = 'task' THEN 'task'
          WHEN operation.id IS NOT NULL THEN 'agent'
          ELSE 'chat'
        END AS mode,
        (COALESCE(operation.tool_calls, 0) > 0 OR COALESCE(reply_stats.tool, FALSE)) AS tool,
        COALESCE(reply_stats.search, FALSE) AS search,
        messages.agent_id AS "agentId",
        messages.session_id AS "sessionId",
        messages.user_id AS "userId",
        messages.created_at AS "createdAt",
        users.email AS "userEmail",
        COALESCE(
          NULLIF(users.full_name, ''),
          NULLIF(users.username, ''),
          NULLIF(CONCAT_WS(' ', users.first_name, users.last_name), '')
        ) AS "userName",
        sessions.title AS "sessionTitle",
        COALESCE(file_stats.file_count, 0) AS "fileCount",
        COALESCE(file_stats.attachments, '[]'::jsonb) AS attachments,
        COALESCE(file_stats.file_count, 0) > 0 AS "attachmentRisk",
        COALESCE(messages.content, '') ~* ${COTTI_AUDIT_CREDENTIAL_RISK_PATTERN} AS "credentialRisk",
        COALESCE(messages.content, '') ~ ${COTTI_AUDIT_CONFIDENTIAL_RISK_PATTERN} AS "confidentialRisk",
        COALESCE(messages.content, '') ~ ${COTTI_AUDIT_PERSONAL_RISK_PATTERN} AS "personalRisk",
        COALESCE(messages.content, '') ~* ${COTTI_AUDIT_SENSITIVE_OPERATION_RISK_PATTERN} AS "sensitiveOperationRisk",
        risk_analysis.status AS "analysisStatus",
        risk_analysis.summary AS "analysisSummary",
        risk_analysis.reason AS "analysisReason",
        risk_analysis.confidence AS "analysisConfidence",
        risk_analysis.evidence AS "analysisEvidence",
        risk_analysis.risk_level AS "analysisRiskLevel",
        risk_analysis.risk_labels AS "analysisRiskLabels",
        risk_analysis.provider AS "analysisProvider",
        risk_analysis.model AS "analysisModel",
        risk_analysis.error AS "analysisError",
        risk_analysis.updated_at AS "analysisUpdatedAt"
      FROM messages
      LEFT JOIN users ON users.id = messages.user_id
      LEFT JOIN sessions ON sessions.id = messages.session_id
      LEFT JOIN LATERAL (
        SELECT
          agent_operations.id,
          agent_operations.model,
          agent_operations.provider,
          agent_operations.tool_calls,
          agent_operations.trigger
        FROM agent_operations
        WHERE agent_operations.parent_operation_id IS NULL
          AND agent_operations.app_context ->> 'sourceMessageId' = messages.id
        ORDER BY agent_operations.created_at ASC, agent_operations.id ASC
        LIMIT 1
      ) operation ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          (ARRAY_AGG(NULLIF(reply.model, '') ORDER BY reply.created_at, reply.id)
            FILTER (WHERE NULLIF(reply.model, '') IS NOT NULL))[1] AS model,
          (ARRAY_AGG(NULLIF(reply.provider, '') ORDER BY reply.created_at, reply.id)
            FILTER (WHERE NULLIF(reply.provider, '') IS NOT NULL))[1] AS provider,
          BOOL_OR(reply.tools IS NOT NULL) AS tool,
          BOOL_OR(reply.search IS NOT NULL) AS search
        FROM messages reply
        WHERE reply.parent_id = messages.id
          AND reply.role = 'assistant'
      ) reply_stats ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) AS file_count,
          JSONB_AGG(
            JSONB_BUILD_OBJECT(
              'id', files.id,
              'name', files.name,
              'fileType', files.file_type,
              'size', files.size,
              'documentId', parsed_document.id,
              'documentTitle', parsed_document.title,
              'extractedTextPreview', parsed_document.content_preview
            )
            ORDER BY files.name, files.id
          ) AS attachments
        FROM messages_files
        INNER JOIN files ON files.id = messages_files.file_id
        LEFT JOIN LATERAL (
          SELECT
            documents.id,
            documents.title,
            NULLIF(SUBSTRING(documents.content FROM 1 FOR 1200), '') AS content_preview
          FROM documents
          WHERE documents.file_id = files.id
          ORDER BY documents.created_at DESC, documents.id DESC
          LIMIT 1
        ) parsed_document ON TRUE
        WHERE messages_files.message_id = messages.id
      ) file_stats ON TRUE
      LEFT JOIN cotti_audit_risk_analyses risk_analysis
        ON risk_analysis.message_id = messages.id
      WHERE messages.id = ${messageId}
        AND messages.role = 'user'
        AND ${buildCottiPlatformAuditedUserCondition(sql`messages.user_id`)}
      LIMIT 1
    `);

    const row = result.rows[0] as unknown as PlatformAuditMessageRow | undefined;
    if (!row) return;

    const attachments = normalizeAttachments(row.attachments);
    const reviewText = buildCottiPlatformAuditReviewText({
      attachments,
      content: row.content,
      contentPreview: row.contentPreview,
    });
    const ruleFlags = detectCottiPlatformAuditRiskFlags(reviewText, row);
    row.riskLevel = getCottiPlatformAuditRiskLevel(ruleFlags);
    row.attachments = attachments;

    return this.mapMessageRow(row, true);
  }

  async getRiskAnalysis(messageId: string): Promise<CottiPlatformAuditRiskAnalysis | undefined> {
    const [row] = await this.db
      .select()
      .from(cottiAuditRiskAnalyses)
      .where(eq(cottiAuditRiskAnalyses.messageId, messageId))
      .limit(1);
    if (!row) return;

    return (
      normalizeCottiPlatformAuditAnalysis({
        analysisConfidence: row.confidence,
        analysisError: row.error,
        analysisEvidence: row.evidence,
        analysisModel: row.model,
        analysisProvider: row.provider,
        analysisReason: row.reason,
        analysisRiskLabels: row.riskLabels,
        analysisRiskLevel: row.riskLevel,
        analysisStatus: row.status,
        analysisSummary: row.summary,
        analysisUpdatedAt: row.updatedAt,
      }) ?? undefined
    );
  }

  async recordMessageView({ adminEmail, adminUserId, metadata, target }: RecordMessageViewParams) {
    await this.db.insert(cottiAuditViewLogs).values({
      adminEmail: adminEmail ?? null,
      adminUserId,
      messageId: target.id,
      metadata: {
        ...metadata,
        attachmentCount: target.attachments.length,
        attachmentIds: target.attachments.map((attachment) => attachment.id),
      },
      sessionId: target.sessionId ?? null,
      targetId: target.id,
      targetType: 'message',
      targetUserEmail: target.userEmail ?? null,
      targetUserId: target.userId,
    });
  }

  private analyzeWithModel = async (
    detail: CottiPlatformAuditDetail,
    adminUserId: string,
  ): Promise<CottiPlatformAuditRiskAnalysis> => {
    if (!auditRiskModelProvider || !auditRiskModel) {
      return buildCottiPlatformAuditRuleAnalysis(detail);
    }

    const runtime = await initModelRuntimeFromDB(this.db, adminUserId, auditRiskModelProvider);
    const sourceText = buildCottiPlatformAuditReviewText(detail, MAX_ANALYSIS_CONTENT_LENGTH);
    let content = '';
    let streamError: unknown;

    const response = await runtime.chat(
      {
        messages: [
          {
            content:
              '你是企业合规审计助手。审计对象包含用户提问及其附件中已提取的文本，不包含大模型回复。请判断这些内容是否需要展示给管理员复核；只有确实涉及疑似泄密、个人信息、敏感操作或违规合规风险时才标记风险。不要做最终违规定性。必须只输出 JSON，不要 Markdown。',
            role: 'system',
          },
          {
            content: [
              '请分析以下用户提问及附件，输出 JSON：',
              '{',
              '  "summary": "一句话风险摘要",',
              '  "reason": "为什么这些片段需要人工复核",',
              '  "confidence": "low|medium|high",',
              '  "riskLevel": "none|low|medium|high",',
              '  "riskLabels": ["标签"],',
              '  "evidence": [{"label":"标签","quote":"原文中的短片段"}]',
              '}',
              '如果只是普通技术咨询、概念解释、公开信息查询、合规培训或上下文不足，请返回 riskLevel=none；evidence 最多 5 条，quote 必须来自原文且不得输出完整原文；无法确认时 confidence=low。',
              '',
              `规则召回标签（仅供参考）：${detail.riskFlags.map((flag) => flag.label).join('、') || '无'}`,
              `待审计内容：${sourceText}`,
            ].join('\n'),
            role: 'user',
          },
        ],
        model: auditRiskModel,
        stream: true,
      },
      {
        callback: {
          onError: async (error) => {
            streamError = error;
          },
          onText: async (text) => {
            content += text;
          },
        },
        signal: AbortSignal.timeout(MODEL_ANALYSIS_TIMEOUT_MS),
        user: adminUserId,
      },
    );

    await consumeStreamUntilDone(response);
    if (streamError) {
      throw new Error(streamError instanceof Error ? streamError.message : String(streamError));
    }

    return parseCottiPlatformAuditModelAnalysis(content, auditRiskModel, auditRiskModelProvider);
  };

  private buildFilteredMessagesQuery = ({
    endAt,
    q,
    query,
    startAt,
  }: {
    endAt: Date;
    q?: string;
    query: z.infer<typeof cottiPlatformAuditQuerySchema>;
    startAt: Date;
  }) => sql`
    WITH base AS MATERIALIZED (
      SELECT
        messages.id,
        COALESCE(NULLIF(operation.provider, ''), reply_stats.provider, messages.provider) AS provider,
        COALESCE(NULLIF(operation.model, ''), reply_stats.model, messages.model) AS model,
        CASE
          WHEN operation.trigger = 'task' THEN 'task'
          WHEN operation.id IS NOT NULL THEN 'agent'
          ELSE 'chat'
        END AS mode,
        (COALESCE(operation.tool_calls, 0) > 0 OR COALESCE(reply_stats.tool, FALSE)) AS tool,
        COALESCE(reply_stats.search, FALSE) AS search,
        messages.agent_id AS "agentId",
        messages.session_id AS "sessionId",
        messages.user_id AS "userId",
        messages.created_at AS "createdAt",
        users.email AS "userEmail",
        COALESCE(
          NULLIF(users.full_name, ''),
          NULLIF(users.username, ''),
          NULLIF(CONCAT_WS(' ', users.first_name, users.last_name), '')
        ) AS "userName",
        sessions.title AS "sessionTitle",
        COALESCE(file_stats.file_count, 0) AS "fileCount",
        COALESCE(file_stats.file_count, 0) > 0 AS "attachmentRisk",
        COALESCE(messages.content, '') ~* ${COTTI_AUDIT_CREDENTIAL_RISK_PATTERN} AS "credentialRisk",
        COALESCE(messages.content, '') ~ ${COTTI_AUDIT_CONFIDENTIAL_RISK_PATTERN} AS "confidentialRisk",
        COALESCE(messages.content, '') ~ ${COTTI_AUDIT_PERSONAL_RISK_PATTERN} AS "personalRisk",
        COALESCE(messages.content, '') ~* ${COTTI_AUDIT_SENSITIVE_OPERATION_RISK_PATTERN} AS "sensitiveOperationRisk",
        risk_analysis.status AS "analysisStatus",
        risk_analysis.summary AS "analysisSummary",
        risk_analysis.reason AS "analysisReason",
        risk_analysis.confidence AS "analysisConfidence",
        risk_analysis.evidence AS "analysisEvidence",
        risk_analysis.risk_level AS "analysisRiskLevel",
        risk_analysis.risk_labels AS "analysisRiskLabels",
        risk_analysis.provider AS "analysisProvider",
        risk_analysis.model AS "analysisModel",
        risk_analysis.error AS "analysisError",
        risk_analysis.updated_at AS "analysisUpdatedAt"
      FROM messages
      LEFT JOIN users ON users.id = messages.user_id
      LEFT JOIN sessions ON sessions.id = messages.session_id
      LEFT JOIN LATERAL (
        SELECT
          agent_operations.id,
          agent_operations.model,
          agent_operations.provider,
          agent_operations.tool_calls,
          agent_operations.trigger
        FROM agent_operations
        WHERE agent_operations.parent_operation_id IS NULL
          AND agent_operations.app_context ->> 'sourceMessageId' = messages.id
        ORDER BY agent_operations.created_at ASC, agent_operations.id ASC
        LIMIT 1
      ) operation ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          (ARRAY_AGG(NULLIF(reply.model, '') ORDER BY reply.created_at, reply.id)
            FILTER (WHERE NULLIF(reply.model, '') IS NOT NULL))[1] AS model,
          (ARRAY_AGG(NULLIF(reply.provider, '') ORDER BY reply.created_at, reply.id)
            FILTER (WHERE NULLIF(reply.provider, '') IS NOT NULL))[1] AS provider,
          BOOL_OR(reply.tools IS NOT NULL) AS tool,
          BOOL_OR(reply.search IS NOT NULL) AS search
        FROM messages reply
        WHERE reply.parent_id = messages.id
          AND reply.role = 'assistant'
      ) reply_stats ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS file_count
        FROM messages_files
        WHERE messages_files.message_id = messages.id
      ) file_stats ON TRUE
      LEFT JOIN cotti_audit_risk_analyses risk_analysis
        ON risk_analysis.message_id = messages.id
      WHERE messages.created_at >= ${startAt}
        AND messages.created_at <= ${endAt}
        AND messages.role = 'user'
        AND ${buildCottiPlatformAuditedUserCondition(sql`messages.user_id`)}
        AND (
          ${q || null}::text IS NULL
          OR LOWER(CONCAT_WS(
            ' ',
            users.email,
            users.normalized_email,
            users.full_name,
            users.username,
            messages.user_id
          )) LIKE ${q ? `%${q}%` : null}
        )
    ),
    enriched AS (
      SELECT
        base.*,
        CASE
          WHEN base."analysisStatus" = 'completed'
            AND base."analysisError" IS NULL
            AND base."analysisRiskLevel" IN ('high', 'medium', 'low', 'none')
            THEN base."analysisRiskLevel"
          WHEN base."credentialRisk" OR base."confidentialRisk" THEN 'high'
          WHEN base."personalRisk" OR base."sensitiveOperationRisk" THEN 'medium'
          WHEN base."attachmentRisk" OR base.tool THEN 'low'
          ELSE 'none'
        END AS "riskLevel"
      FROM base
    ),
    filtered AS (
      SELECT *
      FROM enriched
      WHERE (
        ${query.feature} = 'all'
        OR (${query.feature} = 'agent' AND mode = 'agent')
        OR (${query.feature} = 'chat' AND mode = 'chat')
        OR (${query.feature} = 'task' AND mode = 'task')
        OR (${query.feature} = 'tool' AND tool)
        OR (${query.feature} = 'search' AND search)
      )
      AND (
        ${query.riskLevel} = 'all'
        OR (${query.riskLevel} = 'flagged' AND "riskLevel" <> 'none')
        OR (${query.riskLevel} IN ('high', 'medium', 'low', 'none') AND "riskLevel" = ${query.riskLevel})
      )
    )
  `;

  private claimRiskAnalysis = async ({
    adminEmail,
    adminUserId,
    analysis,
    target,
  }: {
    adminEmail?: null | string;
    adminUserId: string;
    analysis: CottiPlatformAuditRiskAnalysis;
    target: CottiPlatformAuditDetail;
  }) => {
    const rows = await this.db
      .insert(cottiAuditRiskAnalyses)
      .values({
        confidence: analysis.confidence ?? null,
        error: null,
        evidence: analysis.evidence,
        messageId: target.id,
        model: analysis.model ?? null,
        provider: analysis.provider ?? null,
        reason: null,
        requestedByEmail: adminEmail ?? null,
        requestedByUserId: adminUserId,
        riskLabels: analysis.riskLabels,
        riskLevel: analysis.riskLevel ?? null,
        sessionId: target.sessionId ?? null,
        status: 'running',
        summary: null,
        targetUserEmail: target.userEmail ?? null,
        targetUserId: target.userId,
      })
      .onConflictDoUpdate({
        set: {
          confidence: analysis.confidence ?? null,
          error: null,
          evidence: analysis.evidence,
          model: analysis.model ?? null,
          provider: analysis.provider ?? null,
          reason: null,
          requestedByEmail: adminEmail ?? null,
          requestedByUserId: adminUserId,
          riskLabels: analysis.riskLabels,
          riskLevel: analysis.riskLevel ?? null,
          status: 'running',
          summary: null,
          updatedAt: new Date(),
        },
        setWhere: ne(cottiAuditRiskAnalyses.status, 'running'),
        target: cottiAuditRiskAnalyses.messageId,
      })
      .returning({ messageId: cottiAuditRiskAnalyses.messageId });

    return rows.length > 0;
  };

  private mapMessageRow = (
    row: PlatformAuditMessageRow,
    includeContent: boolean,
  ): CottiPlatformAuditDetail => {
    const analysis = normalizeCottiPlatformAuditAnalysis(row);
    const attachments = includeContent ? normalizeAttachments(row.attachments) : [];
    const ruleFlags = includeContent
      ? detectCottiPlatformAuditRiskFlags(
          buildCottiPlatformAuditReviewText({
            attachments,
            content: row.content,
            contentPreview: row.contentPreview,
          }),
          row,
        )
      : buildCottiPlatformAuditRuleFlags(row as CottiPlatformAuditRuleSignals);
    const useAnalysis = analysis?.status === 'completed';
    const riskFlags = useAnalysis ? buildCottiPlatformAuditAnalysisFlags(analysis) : ruleFlags;
    const riskLevel = useAnalysis
      ? normalizeCottiPlatformAuditRiskLevel(analysis.riskLevel)
      : row.riskLevel
        ? normalizeCottiPlatformAuditRiskLevel(row.riskLevel)
        : getCottiPlatformAuditRiskLevel(ruleFlags);

    const item: CottiPlatformAuditDetail = {
      agentId: row.agentId,
      analysis,
      attachments,
      createdAt: toDate(row.createdAt).toISOString(),
      fileCount: toNumber(row.fileCount),
      id: row.id,
      model: row.model,
      mode: row.mode,
      provider: row.provider,
      riskFlags,
      riskLevel,
      search: row.search,
      sessionId: row.sessionId,
      sessionTitle: row.sessionTitle,
      tool: row.tool,
      userEmail: row.userEmail,
      userId: row.userId,
      userName: row.userName,
    };

    if (includeContent) {
      item.content = row.content;
      item.contentPreview = row.contentPreview;
    }

    return item;
  };

  private upsertRiskAnalysis = async ({
    adminEmail,
    adminUserId,
    analysis,
    target,
  }: {
    adminEmail?: null | string;
    adminUserId: string;
    analysis: CottiPlatformAuditRiskAnalysis;
    target: CottiPlatformAuditDetail;
  }) => {
    await this.db
      .insert(cottiAuditRiskAnalyses)
      .values({
        confidence: analysis.confidence ?? null,
        error: analysis.error ?? null,
        evidence: analysis.evidence,
        messageId: target.id,
        model: analysis.model ?? null,
        provider: analysis.provider ?? null,
        reason: analysis.reason ?? null,
        requestedByEmail: adminEmail ?? null,
        requestedByUserId: adminUserId,
        riskLabels: analysis.riskLabels,
        riskLevel: analysis.riskLevel ?? null,
        sessionId: target.sessionId ?? null,
        status: analysis.status,
        summary: analysis.summary ?? null,
        targetUserEmail: target.userEmail ?? null,
        targetUserId: target.userId,
      })
      .onConflictDoUpdate({
        set: {
          confidence: analysis.confidence ?? null,
          error: analysis.error ?? null,
          evidence: analysis.evidence,
          model: analysis.model ?? null,
          provider: analysis.provider ?? null,
          reason: analysis.reason ?? null,
          requestedByEmail: adminEmail ?? null,
          requestedByUserId: adminUserId,
          riskLabels: analysis.riskLabels,
          riskLevel: analysis.riskLevel ?? null,
          status: analysis.status,
          summary: analysis.summary ?? null,
          updatedAt: new Date(),
        },
        target: cottiAuditRiskAnalyses.messageId,
      });
  };
}

export const isCottiPlatformAuditPageSize = (
  value: number,
): value is (typeof COTTI_PLATFORM_AUDIT_PAGE_SIZES)[number] =>
  COTTI_PLATFORM_AUDIT_PAGE_SIZES.includes(
    value as (typeof COTTI_PLATFORM_AUDIT_PAGE_SIZES)[number],
  );
