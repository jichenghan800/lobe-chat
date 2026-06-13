import { consumeStreamUntilDone } from '@lobechat/model-runtime';
import { safeParseJSON } from '@lobechat/utils';
import { sql } from 'drizzle-orm';

import { cottiAuditRiskAnalyses, cottiAuditViewLogs } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import { initModelRuntimeFromDB } from '@/server/modules/ModelRuntime';
import type {
  PlatformAuditDashboard,
  PlatformAuditDetail,
  PlatformAuditQuery,
  PlatformAuditRiskAnalysis,
  PlatformAuditRiskEvidence,
  PlatformAuditRiskFlag,
  PlatformAuditRiskLevel,
} from '@/types/platformAudit';

interface PlatformAuditMessageRow {
  agentId: null | string;
  analysisConfidence?: null | PlatformAuditRiskAnalysis['confidence'];
  analysisError?: null | string;
  analysisEvidence?: null | PlatformAuditRiskEvidence[] | string;
  analysisModel?: null | string;
  analysisProvider?: null | string;
  analysisReason?: null | string;
  analysisRiskLabels?: null | string[] | string;
  analysisRiskLevel?: null | string;
  analysisStatus?: null | PlatformAuditRiskAnalysis['status'];
  analysisSummary?: null | string;
  analysisUpdatedAt?: Date | null | string;
  attachmentRisk?: boolean;
  confidentialRisk?: boolean;
  content: null | string;
  contentPreview: null | string;
  createdAt: Date | string;
  credentialRisk?: boolean;
  error: boolean;
  fileCount: number | string;
  id: string;
  model: null | string;
  personalRisk?: boolean;
  provider: null | string;
  riskLevel?: PlatformAuditRiskLevel;
  role: string;
  search: boolean;
  sensitiveOperationRisk?: boolean;
  sessionId: null | string;
  sessionTitle: null | string;
  tool: boolean;
  userEmail: null | string;
  userId: string;
}

interface RecordViewParams {
  adminEmail?: null | string;
  adminUserId: string;
  metadata?: Record<string, unknown>;
  target: PlatformAuditDetail;
}

interface AnalyzeMessageParams {
  adminEmail?: null | string;
  adminUserId: string;
  force?: boolean;
  messageId: string;
}

const DEFAULT_RANGE = 1;
const DEFAULT_FEATURE = 'all';
const DEFAULT_RISK_LEVEL = 'all';
const MAX_AUDIT_ITEMS = 200;
const MAX_ANALYSIS_CONTENT_LENGTH = 12_000;

const credentialRiskPattern =
  '(api[_-]?key|secret|token|password|passwd|access[_-]?key|private[_-]?key|AKIA|sk-[A-Z0-9])';
const confidentialRiskPattern =
  '(机密|绝密|保密|内部资料|未公开|竞品策略|价格底线|源代码|财务报表|薪酬|裁员)';
const personalRiskPattern = '(身份证|手机号|银行卡|住址|家庭住址|护照|社保|个人信息)';
const sensitiveOperationRiskPattern =
  '(删除数据|导出数据|批量下载|生产库|数据库密码|root权限|sudo|rm -rf|转账|付款)';
const auditRiskModelProvider = process.env.COTTI_AUDIT_RISK_MODEL_PROVIDER?.trim();
const auditRiskModel = process.env.COTTI_AUDIT_RISK_MODEL?.trim();

const RISK_FLAG_DEFINITIONS: Array<{
  key: string;
  label: string;
  level: Exclude<PlatformAuditRiskLevel, 'none'>;
  pattern: RegExp;
}> = [
  {
    key: 'credential',
    label: '疑似密钥/凭证',
    level: 'high',
    pattern:
      /(api[_-]?key|secret|token|password|passwd|access[_-]?key|private[_-]?key|AKIA|sk-[A-Z0-9])/i,
  },
  {
    key: 'confidential',
    label: '疑似公司机密',
    level: 'high',
    pattern: /(机密|绝密|保密|内部资料|未公开|竞品策略|价格底线|源代码|财务报表|薪酬|裁员)/,
  },
  {
    key: 'personal',
    label: '疑似个人信息',
    level: 'medium',
    pattern: /(身份证|手机号|银行卡|住址|家庭住址|护照|社保|个人信息)/,
  },
  {
    key: 'sensitive_operation',
    label: '敏感操作',
    level: 'medium',
    pattern: /(删除数据|导出数据|批量下载|生产库|数据库密码|root权限|sudo|rm -rf|转账|付款)/i,
  },
];

const toDate = (value: Date | string) => (value instanceof Date ? value : new Date(value));
const toNumber = (value: number | string | null | undefined) => Number(value || 0);

const normalizeRiskLevel = (flags: PlatformAuditRiskFlag[]): PlatformAuditRiskLevel => {
  if (flags.some((flag) => flag.level === 'high')) return 'high';
  if (flags.some((flag) => flag.level === 'medium')) return 'medium';
  if (flags.some((flag) => flag.level === 'low')) return 'low';
  return 'none';
};

const detectRiskFlags = (content: null | string, row: PlatformAuditMessageRow) => {
  const flags: PlatformAuditRiskFlag[] = [];
  const text = content || '';

  for (const definition of RISK_FLAG_DEFINITIONS) {
    if (!definition.pattern.test(text)) continue;

    flags.push({
      key: definition.key,
      label: definition.label,
      level: definition.level,
    });
  }

  if (row.fileCount && toNumber(row.fileCount) > 0) {
    flags.push({ key: 'attachment', label: '包含附件', level: 'low' });
  }

  if (row.tool) {
    flags.push({ key: 'tool_call', label: '调用工具', level: 'low' });
  }

  return flags;
};

const buildRiskFlagsFromRow = (row: PlatformAuditMessageRow) => {
  const flags: PlatformAuditRiskFlag[] = [];

  if (row.credentialRisk) {
    flags.push({ key: 'credential', label: '疑似密钥/凭证', level: 'high' });
  }

  if (row.confidentialRisk) {
    flags.push({ key: 'confidential', label: '疑似公司机密', level: 'high' });
  }

  if (row.personalRisk) {
    flags.push({ key: 'personal', label: '疑似个人信息', level: 'medium' });
  }

  if (row.sensitiveOperationRisk) {
    flags.push({ key: 'sensitive_operation', label: '敏感操作', level: 'medium' });
  }

  if (row.attachmentRisk || toNumber(row.fileCount) > 0) {
    flags.push({ key: 'attachment', label: '包含附件', level: 'low' });
  }

  if (row.tool) {
    flags.push({ key: 'tool_call', label: '调用工具', level: 'low' });
  }

  return flags;
};

const ensureArray = <T>(value: null | string | T[] | undefined): T[] => {
  if (Array.isArray(value)) return value;
  if (!value) return [];

  const parsed = safeParseJSON<T[]>(value);
  return Array.isArray(parsed) ? parsed : [];
};

const normalizeAnalysis = (row: PlatformAuditMessageRow): null | PlatformAuditRiskAnalysis => {
  if (!row.analysisStatus) return null;

  return {
    confidence: row.analysisConfidence ?? null,
    error: row.analysisError ?? null,
    evidence: ensureArray<PlatformAuditRiskEvidence>(row.analysisEvidence),
    model: row.analysisModel ?? null,
    provider: row.analysisProvider ?? null,
    reason: row.analysisReason ?? null,
    riskLabels: ensureArray<string>(row.analysisRiskLabels),
    riskLevel: row.analysisRiskLevel ?? null,
    status: row.analysisStatus,
    summary: row.analysisSummary ?? null,
    updatedAt: row.analysisUpdatedAt ? toDate(row.analysisUpdatedAt).toISOString() : null,
  };
};

const extractQuote = (text: string, pattern: RegExp): null | string => {
  const match = pattern.exec(text);
  if (!match?.index && match?.index !== 0) return null;

  const start = Math.max(match.index - 36, 0);
  const end = Math.min(match.index + match[0].length + 36, text.length);

  return text.slice(start, end).replaceAll(/\s+/g, ' ').trim();
};

const buildRuleBasedAnalysis = (detail: PlatformAuditDetail): PlatformAuditRiskAnalysis => {
  const content = detail.content || detail.contentPreview || '';
  const evidence: PlatformAuditRiskEvidence[] = [];

  for (const definition of RISK_FLAG_DEFINITIONS) {
    const quote = extractQuote(content, new RegExp(definition.pattern));
    if (!quote) continue;

    evidence.push({ label: definition.label, quote });
  }

  if (detail.fileCount > 0) {
    evidence.push({ label: '包含附件', quote: `该消息包含 ${detail.fileCount} 个附件` });
  }

  if (detail.tool) {
    evidence.push({ label: '调用工具', quote: '该消息或回复存在工具调用记录' });
  }

  const labels = detail.riskFlags.map((flag) => flag.label);
  const summary =
    evidence.length > 0
      ? `命中 ${labels.join('、') || '疑似风险'}，建议人工核对上下文。`
      : '未提取到明确风险片段，建议结合原文人工判断。';

  return {
    confidence: detail.riskLevel === 'high' ? 'medium' : 'low',
    error: null,
    evidence,
    model: 'rule-based',
    provider: 'local',
    reason: '基于关键词、附件和工具调用记录提取疑似风险片段，作为人工复核线索。',
    riskLabels: labels,
    riskLevel: detail.riskLevel,
    status: 'completed',
    summary,
  };
};

const parseModelAnalysis = (content: string): PlatformAuditRiskAnalysis => {
  const jsonText = content
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/\s*```$/, '');
  const parsed = safeParseJSON<Partial<PlatformAuditRiskAnalysis>>(jsonText);

  if (!parsed) throw new Error('模型返回内容不是合法 JSON');

  return {
    confidence:
      parsed.confidence === 'high' || parsed.confidence === 'medium' ? parsed.confidence : 'low',
    error: null,
    evidence: Array.isArray(parsed.evidence) ? parsed.evidence.slice(0, 8) : [],
    model: auditRiskModel,
    provider: auditRiskModelProvider,
    reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 1000) : null,
    riskLabels: Array.isArray(parsed.riskLabels) ? parsed.riskLabels.slice(0, 8) : [],
    riskLevel: typeof parsed.riskLevel === 'string' ? parsed.riskLevel : null,
    status: 'completed',
    summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 500) : null,
  };
};

export class PlatformAuditService {
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase) {
    this.db = db;
  }

  getDashboard = async (query: PlatformAuditQuery = {}): Promise<PlatformAuditDashboard> => {
    const range = query.range ?? DEFAULT_RANGE;
    const feature = query.feature ?? DEFAULT_FEATURE;
    const riskLevel = query.riskLevel ?? DEFAULT_RISK_LEVEL;
    const endAt = new Date();
    const startAt = new Date(endAt.getTime() - range * 24 * 60 * 60 * 1000);
    const emailQuery = query.email?.trim().toLowerCase();

    const result = await this.db.execute(sql`
      WITH base AS MATERIALIZED (
        SELECT
          messages.id,
          messages.role,
          LEFT(COALESCE(messages.content, ''), 160) AS "contentPreview",
          messages.provider,
          messages.model,
          messages.error IS NOT NULL AS error,
          messages.tools IS NOT NULL AS tool,
          messages.search IS NOT NULL AS search,
          messages.agent_id AS "agentId",
          messages.session_id AS "sessionId",
          messages.user_id AS "userId",
          messages.created_at AS "createdAt",
          users.email AS "userEmail",
          sessions.title AS "sessionTitle",
          EXISTS (
            SELECT 1
            FROM messages_files
            WHERE messages_files.message_id = messages.id
            LIMIT 1
          ) AS "attachmentRisk",
          COALESCE(messages.content, '') ~* ${credentialRiskPattern} AS "credentialRisk",
          COALESCE(messages.content, '') ~ ${confidentialRiskPattern} AS "confidentialRisk",
          COALESCE(messages.content, '') ~ ${personalRiskPattern} AS "personalRisk",
          COALESCE(messages.content, '') ~* ${sensitiveOperationRiskPattern} AS "sensitiveOperationRisk"
        FROM messages
        LEFT JOIN users ON users.id = messages.user_id
        LEFT JOIN sessions ON sessions.id = messages.session_id
        WHERE messages.created_at >= ${startAt}
          AND messages.created_at <= ${endAt}
          AND (
            ${emailQuery || null}::text IS NULL
            OR LOWER(COALESCE(users.email, users.normalized_email, messages.user_id)) LIKE ${emailQuery ? `%${emailQuery}%` : null}
          )
      ),
      enriched AS (
        SELECT
          base.*,
          CASE
            WHEN base.error THEN 'error'
            WHEN base.tool THEN 'tool'
            WHEN base.search THEN 'search'
            WHEN base."agentId" IS NOT NULL THEN 'agent'
            ELSE 'chat'
          END AS "featureType",
          CASE
            WHEN base."credentialRisk" OR base."confidentialRisk" THEN 'high'
            WHEN base."personalRisk" OR base."sensitiveOperationRisk" THEN 'medium'
            WHEN base."attachmentRisk" OR base.tool THEN 'low'
            ELSE 'none'
          END AS "riskLevel"
        FROM base
      )
      SELECT
        enriched.id,
        enriched.role,
        enriched."contentPreview",
        enriched.provider,
        enriched.model,
        enriched.error,
        enriched.tool,
        enriched.search,
        enriched."agentId",
        enriched."sessionId",
        enriched."userId",
        enriched."createdAt",
        enriched."userEmail",
        enriched."sessionTitle",
        enriched."attachmentRisk",
        enriched."credentialRisk",
        enriched."confidentialRisk",
        enriched."personalRisk",
        enriched."sensitiveOperationRisk",
        enriched."riskLevel",
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
        risk_analysis.updated_at AS "analysisUpdatedAt",
        (
          SELECT COUNT(*)
          FROM messages_files
          WHERE messages_files.message_id = enriched.id
        ) AS "fileCount"
      FROM enriched
      LEFT JOIN cotti_audit_risk_analyses risk_analysis
        ON risk_analysis.message_id = enriched.id
      WHERE (${feature} = 'all' OR enriched."featureType" = ${feature})
        AND (
          ${riskLevel} = 'all'
          OR enriched."riskLevel" = ${riskLevel}
        )
      ORDER BY enriched."createdAt" DESC
      LIMIT ${MAX_AUDIT_ITEMS}
    `);

    const items = result.rows
      .map((row) => this.mapMessageRow(row as unknown as PlatformAuditMessageRow, false));

    return {
      items,
      overview: {
        agentMessages: items.filter((item) => item.agentId).length,
        errorMessages: items.filter((item) => item.error).length,
        highRiskMessages: items.filter((item) => item.riskLevel === 'high').length,
        searchMessages: items.filter((item) => item.search).length,
        toolMessages: items.filter((item) => item.tool).length,
        totalMessages: items.length,
      },
      query: {
        email: query.email,
        feature,
        range,
        riskLevel,
      },
    };
  };

  getMessageDetail = async (messageId: string): Promise<PlatformAuditDetail | undefined> => {
    const result = await this.db.execute(sql`
      WITH file_counts AS (
        SELECT message_id, COUNT(*) AS file_count
        FROM messages_files
        GROUP BY message_id
      )
      SELECT
        messages.id,
        messages.role,
        messages.content,
        LEFT(COALESCE(messages.content, ''), 160) AS "contentPreview",
        messages.provider,
        messages.model,
        messages.error IS NOT NULL AS error,
        messages.tools IS NOT NULL AS tool,
        messages.search IS NOT NULL AS search,
        messages.agent_id AS "agentId",
        messages.session_id AS "sessionId",
        messages.user_id AS "userId",
        messages.created_at AS "createdAt",
        users.email AS "userEmail",
        sessions.title AS "sessionTitle",
        COALESCE(file_counts.file_count, 0) AS "fileCount"
      FROM messages
      LEFT JOIN users ON users.id = messages.user_id
      LEFT JOIN sessions ON sessions.id = messages.session_id
      LEFT JOIN file_counts ON file_counts.message_id = messages.id
      WHERE messages.id = ${messageId}
      LIMIT 1
    `);

    const row = result.rows[0] as unknown as PlatformAuditMessageRow | undefined;
    if (!row) return;

    return this.mapMessageRow(row, true);
  };

  analyzeMessageRisk = async ({
    adminEmail,
    adminUserId,
    force,
    messageId,
  }: AnalyzeMessageParams): Promise<PlatformAuditRiskAnalysis> => {
    if (!force) {
      const existing = await this.getRiskAnalysis(messageId);
      if (existing?.status === 'completed') return existing;
    }

    const detail = await this.getMessageDetail(messageId);
    if (!detail) throw new Error('Audit message not found.');

    await this.upsertRiskAnalysis({
      adminEmail,
      adminUserId,
      analysis: {
        confidence: null,
        error: null,
        evidence: [],
        model: auditRiskModel ?? null,
        provider: auditRiskModelProvider ?? null,
        reason: null,
        riskLabels: detail.riskFlags.map((flag) => flag.label),
        riskLevel: detail.riskLevel,
        status: 'running',
        summary: null,
      },
      target: detail,
    });

    const fallbackAnalysis = buildRuleBasedAnalysis(detail);
    let analysis = fallbackAnalysis;

    if (auditRiskModelProvider && auditRiskModel) {
      try {
        analysis = await this.analyzeWithModel(detail, adminUserId);
      } catch (error) {
        analysis = {
          ...fallbackAnalysis,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    await this.upsertRiskAnalysis({
      adminEmail,
      adminUserId,
      analysis,
      target: detail,
    });

    return analysis;
  };

  getRiskAnalysis = async (messageId: string): Promise<PlatformAuditRiskAnalysis | undefined> => {
    const result = await this.db.execute(sql`
      SELECT
        status AS "analysisStatus",
        summary AS "analysisSummary",
        reason AS "analysisReason",
        confidence AS "analysisConfidence",
        evidence AS "analysisEvidence",
        risk_level AS "analysisRiskLevel",
        risk_labels AS "analysisRiskLabels",
        provider AS "analysisProvider",
        model AS "analysisModel",
        error AS "analysisError",
        updated_at AS "analysisUpdatedAt"
      FROM cotti_audit_risk_analyses
      WHERE message_id = ${messageId}
      LIMIT 1
    `);

    const row = result.rows[0] as unknown as PlatformAuditMessageRow | undefined;
    if (!row) return;

    return normalizeAnalysis(row) ?? undefined;
  };

  recordMessageView = async ({ adminEmail, adminUserId, metadata, target }: RecordViewParams) => {
    await this.db.insert(cottiAuditViewLogs).values({
      adminEmail: adminEmail ?? null,
      adminUserId,
      messageId: target.id,
      metadata: metadata ?? {},
      sessionId: target.sessionId ?? null,
      targetId: target.id,
      targetType: 'message',
      targetUserEmail: target.userEmail ?? null,
      targetUserId: target.userId,
    });
  };

  private analyzeWithModel = async (
    detail: PlatformAuditDetail,
    adminUserId: string,
  ): Promise<PlatformAuditRiskAnalysis> => {
    if (!auditRiskModelProvider || !auditRiskModel) {
      return buildRuleBasedAnalysis(detail);
    }

    const runtime = await initModelRuntimeFromDB(this.db, adminUserId, auditRiskModelProvider);
    let content = '';
    let streamError: unknown;
    const sourceText = (detail.content || '').slice(0, MAX_ANALYSIS_CONTENT_LENGTH);

    const response = await runtime.chat(
      {
        messages: [
          {
            content:
              '你是企业合规审计助手。请只从用户消息中提取疑似风险片段，帮助人工复核，不要做最终违规定性。必须只输出 JSON，不要 Markdown。',
            role: 'system',
          },
          {
            content: [
              '请分析以下消息，输出 JSON：',
              '{',
              '  "summary": "一句话风险摘要",',
              '  "reason": "为什么这些片段需要人工复核",',
              '  "confidence": "low|medium|high",',
              '  "riskLevel": "none|low|medium|high",',
              '  "riskLabels": ["标签"],',
              '  "evidence": [{"label":"标签","quote":"原文中的短片段"}]',
              '}',
              '要求：evidence 最多 5 条；quote 必须来自原文；不要输出完整原文；无法确认时 confidence 用 low。',
              '',
              `规则初筛风险：${detail.riskFlags.map((flag) => flag.label).join('、') || '无'}`,
              `消息原文：${sourceText}`,
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
        user: adminUserId,
      },
    );

    await consumeStreamUntilDone(response);

    if (streamError) {
      throw new Error(
        streamError instanceof Error ? streamError.message : JSON.stringify(streamError),
      );
    }

    return parseModelAnalysis(content);
  };

  private upsertRiskAnalysis = async ({
    adminEmail,
    adminUserId,
    analysis,
    target,
  }: {
    adminEmail?: null | string;
    adminUserId: string;
    analysis: PlatformAuditRiskAnalysis;
    target: PlatformAuditDetail;
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

  private mapMessageRow = (
    row: PlatformAuditMessageRow,
    includeContent: boolean,
  ): PlatformAuditDetail => {
    const riskFlags = detectRiskFlags(row.content, row);
    const dashboardRiskFlags = includeContent ? undefined : buildRiskFlagsFromRow(row);
    const normalizedRiskFlags = dashboardRiskFlags ?? riskFlags;
    const item: PlatformAuditDetail = {
      agentId: row.agentId,
      analysis: normalizeAnalysis(row),
      contentPreview: row.contentPreview,
      createdAt: toDate(row.createdAt).toISOString(),
      error: row.error,
      fileCount: toNumber(row.fileCount),
      id: row.id,
      model: row.model,
      provider: row.provider,
      riskFlags: normalizedRiskFlags,
      riskLevel: row.riskLevel ?? normalizeRiskLevel(normalizedRiskFlags),
      role: row.role,
      search: row.search,
      sessionId: row.sessionId,
      sessionTitle: row.sessionTitle,
      tool: row.tool,
      userEmail: row.userEmail,
      userId: row.userId,
    };

    if (includeContent) item.content = row.content;

    return item;
  };
}
