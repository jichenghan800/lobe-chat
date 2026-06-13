import { sql } from 'drizzle-orm';

import { cottiAuditViewLogs } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import type {
  PlatformAuditDashboard,
  PlatformAuditDetail,
  PlatformAuditFeatureType,
  PlatformAuditItem,
  PlatformAuditQuery,
  PlatformAuditRiskFlag,
  PlatformAuditRiskLevel,
} from '@/types/platformAudit';

interface PlatformAuditMessageRow {
  agentId: null | string;
  content: null | string;
  contentPreview: null | string;
  createdAt: Date | string;
  error: boolean;
  fileCount: number | string;
  id: string;
  model: null | string;
  provider: null | string;
  role: string;
  search: boolean;
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

const DEFAULT_RANGE = 1;
const DEFAULT_FEATURE = 'all';
const DEFAULT_RISK_LEVEL = 'all';
const MAX_AUDIT_ITEMS = 200;
const QUERY_ITEM_LIMIT = 500;

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

const getFeatureType = (item: PlatformAuditItem): PlatformAuditFeatureType => {
  if (item.error) return 'error';
  if (item.tool) return 'tool';
  if (item.search) return 'search';
  if (item.agentId) return 'agent';
  return 'chat';
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
      WHERE messages.created_at >= ${startAt}
        AND messages.created_at <= ${endAt}
        AND (
          ${emailQuery || null}::text IS NULL
          OR LOWER(COALESCE(users.email, users.normalized_email, messages.user_id)) LIKE ${emailQuery ? `%${emailQuery}%` : null}
        )
      ORDER BY messages.created_at DESC
      LIMIT ${QUERY_ITEM_LIMIT}
    `);

    const items = result.rows
      .map((row) => this.mapMessageRow(row as unknown as PlatformAuditMessageRow, false))
      .filter((item) => feature === 'all' || getFeatureType(item) === feature)
      .filter((item) => riskLevel === 'all' || item.riskLevel === riskLevel)
      .slice(0, MAX_AUDIT_ITEMS);

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

  private mapMessageRow = (
    row: PlatformAuditMessageRow,
    includeContent: boolean,
  ): PlatformAuditDetail => {
    const riskFlags = detectRiskFlags(row.content, row);
    const item: PlatformAuditDetail = {
      agentId: row.agentId,
      contentPreview: row.contentPreview,
      createdAt: toDate(row.createdAt).toISOString(),
      error: row.error,
      fileCount: toNumber(row.fileCount),
      id: row.id,
      model: row.model,
      provider: row.provider,
      riskFlags,
      riskLevel: normalizeRiskLevel(riskFlags),
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
