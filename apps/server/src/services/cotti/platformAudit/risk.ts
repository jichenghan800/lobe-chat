import { safeParseJSON } from '@lobechat/utils';

import type {
  CottiPlatformAuditDetail,
  CottiPlatformAuditRiskAnalysis,
  CottiPlatformAuditRiskEvidence,
  CottiPlatformAuditRiskFlag,
  CottiPlatformAuditRiskLevel,
} from '@/types/cotti/platformAudit';

export const COTTI_AUDIT_CREDENTIAL_RISK_PATTERN =
  '(api[_-]?key|secret|token|password|passwd|access[_-]?key|private[_-]?key|AKIA|sk-[A-Z0-9])';
export const COTTI_AUDIT_CONFIDENTIAL_RISK_PATTERN =
  '(机密|绝密|保密|内部资料|未公开|竞品策略|价格底线|源代码|财务报表|薪酬|裁员)';
export const COTTI_AUDIT_PERSONAL_RISK_PATTERN =
  '(身份证|手机号|银行卡|住址|家庭住址|护照|社保|个人信息)';
export const COTTI_AUDIT_SENSITIVE_OPERATION_RISK_PATTERN =
  '(删除数据|导出数据|批量下载|生产库|数据库密码|root权限|sudo|rm -rf|转账|付款)';

interface RiskFlagDefinition {
  key: string;
  label: string;
  level: Exclude<CottiPlatformAuditRiskLevel, 'none'>;
  pattern: RegExp;
}

export interface CottiPlatformAuditAnalysisRow {
  analysisConfidence?: CottiPlatformAuditRiskAnalysis['confidence'];
  analysisError?: null | string;
  analysisEvidence?: CottiPlatformAuditRiskEvidence[] | null | string;
  analysisModel?: null | string;
  analysisProvider?: null | string;
  analysisReason?: null | string;
  analysisRiskLabels?: null | string[] | string;
  analysisRiskLevel?: CottiPlatformAuditRiskLevel | null | string;
  analysisStatus?: CottiPlatformAuditRiskAnalysis['status'] | null;
  analysisSummary?: null | string;
  analysisUpdatedAt?: Date | null | string;
}

export interface CottiPlatformAuditRuleSignals {
  attachmentRisk?: boolean;
  confidentialRisk?: boolean;
  credentialRisk?: boolean;
  fileCount?: number | string;
  personalRisk?: boolean;
  sensitiveOperationRisk?: boolean;
  tool?: boolean;
}

const RISK_FLAG_DEFINITIONS: RiskFlagDefinition[] = [
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

const toNumber = (value: number | string | null | undefined) => Number(value || 0);

export const normalizeCottiPlatformAuditRiskLevel = (
  value: unknown,
): CottiPlatformAuditRiskLevel =>
  value === 'high' || value === 'medium' || value === 'low' || value === 'none' ? value : 'none';

export const getCottiPlatformAuditRiskLevel = (
  flags: CottiPlatformAuditRiskFlag[],
): CottiPlatformAuditRiskLevel => {
  if (flags.some((flag) => flag.level === 'high')) return 'high';
  if (flags.some((flag) => flag.level === 'medium')) return 'medium';
  if (flags.some((flag) => flag.level === 'low')) return 'low';
  return 'none';
};

export const buildCottiPlatformAuditRuleFlags = (
  signals: CottiPlatformAuditRuleSignals,
): CottiPlatformAuditRiskFlag[] => {
  const flags: CottiPlatformAuditRiskFlag[] = [];

  if (signals.credentialRisk) {
    flags.push({ key: 'credential', label: '疑似密钥/凭证', level: 'high' });
  }
  if (signals.confidentialRisk) {
    flags.push({ key: 'confidential', label: '疑似公司机密', level: 'high' });
  }
  if (signals.personalRisk) {
    flags.push({ key: 'personal', label: '疑似个人信息', level: 'medium' });
  }
  if (signals.sensitiveOperationRisk) {
    flags.push({ key: 'sensitive_operation', label: '敏感操作', level: 'medium' });
  }
  if (signals.attachmentRisk || toNumber(signals.fileCount) > 0) {
    flags.push({ key: 'attachment', label: '包含附件', level: 'low' });
  }
  if (signals.tool) {
    flags.push({ key: 'tool_call', label: '调用工具', level: 'low' });
  }

  return flags;
};

export const detectCottiPlatformAuditRiskFlags = (
  content: null | string,
  signals: CottiPlatformAuditRuleSignals,
) => {
  const flags: CottiPlatformAuditRiskFlag[] = [];
  const text = content || '';

  for (const definition of RISK_FLAG_DEFINITIONS) {
    if (!definition.pattern.test(text)) continue;
    flags.push({
      key: definition.key,
      label: definition.label,
      level: definition.level,
    });
  }

  if (toNumber(signals.fileCount) > 0) {
    flags.push({ key: 'attachment', label: '包含附件', level: 'low' });
  }
  if (signals.tool) {
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

export const normalizeCottiPlatformAuditAnalysis = (
  row: CottiPlatformAuditAnalysisRow,
): CottiPlatformAuditRiskAnalysis | null => {
  if (!row.analysisStatus) return null;

  return {
    confidence: row.analysisConfidence ?? null,
    error: row.analysisError ?? null,
    evidence: ensureArray<CottiPlatformAuditRiskEvidence>(row.analysisEvidence),
    model: row.analysisModel ?? null,
    provider: row.analysisProvider ?? null,
    reason: row.analysisReason ?? null,
    riskLabels: ensureArray<string>(row.analysisRiskLabels),
    riskLevel: normalizeCottiPlatformAuditRiskLevel(row.analysisRiskLevel),
    status: row.analysisStatus,
    summary: row.analysisSummary ?? null,
    updatedAt: row.analysisUpdatedAt ? new Date(row.analysisUpdatedAt).toISOString() : null,
  };
};

export const buildCottiPlatformAuditAnalysisFlags = (
  analysis: CottiPlatformAuditRiskAnalysis | null,
): CottiPlatformAuditRiskFlag[] => {
  if (!analysis || analysis.status !== 'completed' || analysis.riskLevel === 'none') return [];

  const riskLevel = normalizeCottiPlatformAuditRiskLevel(analysis.riskLevel);
  if (riskLevel === 'none') return [];

  return analysis.riskLabels.map((label) => ({
    key: `ai_${label}`,
    label,
    level: riskLevel,
  }));
};

export const buildCottiPlatformAuditReviewText = (
  detail: Pick<CottiPlatformAuditDetail, 'attachments' | 'content' | 'contentPreview'>,
  maxLength = 12_000,
) => {
  const attachmentText = detail.attachments
    .map((attachment) => {
      const metadata = `[附件：${attachment.name}；类型：${attachment.fileType}；大小：${attachment.size} 字节]`;

      return attachment.extractedTextPreview
        ? `${metadata}\n${attachment.extractedTextPreview}`
        : `${metadata}\n[未提取到可审计文本]`;
    })
    .join('\n\n');
  const prompt = detail.content || detail.contentPreview || '';
  const promptBudget = attachmentText ? Math.floor(maxLength / 2) : maxLength;

  return [`用户提问：\n${prompt.slice(0, promptBudget)}`, attachmentText]
    .filter(Boolean)
    .join('\n\n附件：\n')
    .slice(0, maxLength);
};

const extractQuote = (text: string, pattern: RegExp) => {
  const match = pattern.exec(text);
  if (match?.index === undefined) return null;

  const start = Math.max(match.index - 36, 0);
  const end = Math.min(match.index + match[0].length + 36, text.length);

  return text.slice(start, end).replaceAll(/\s+/g, ' ').trim();
};

export const buildCottiPlatformAuditRuleAnalysis = (
  detail: CottiPlatformAuditDetail,
): CottiPlatformAuditRiskAnalysis => {
  const content = buildCottiPlatformAuditReviewText(detail);
  const evidence: CottiPlatformAuditRiskEvidence[] = [];

  for (const definition of RISK_FLAG_DEFINITIONS) {
    const quote = extractQuote(content, new RegExp(definition.pattern));
    if (quote) evidence.push({ label: definition.label, quote });
  }

  if (detail.fileCount > 0) {
    const attachmentNames = detail.attachments
      .slice(0, 5)
      .map((attachment) => attachment.name)
      .join('、');
    evidence.push({
      label: '包含附件',
      quote: attachmentNames
        ? `该消息包含 ${detail.fileCount} 个附件：${attachmentNames}`
        : `该消息包含 ${detail.fileCount} 个附件`,
    });
  }
  if (detail.tool) {
    evidence.push({ label: '调用工具', quote: '该用户提问存在工具调用记录' });
  }

  const labels = detail.riskFlags.map((flag) => flag.label);

  return {
    confidence: detail.riskLevel === 'high' ? 'medium' : 'low',
    error: null,
    evidence,
    model: 'rule-based',
    provider: 'local',
    reason: '基于关键词、附件和工具调用记录提取疑似风险片段，仅作为人工复核线索。',
    riskLabels: labels,
    riskLevel: detail.riskLevel,
    status: 'completed',
    summary:
      evidence.length > 0
        ? `命中 ${labels.join('、') || '疑似风险'}，建议人工核对上下文。`
        : '未提取到明确风险片段，建议结合原文人工判断。',
  };
};

export const parseCottiPlatformAuditModelAnalysis = (
  content: string,
  model: string,
  provider: string,
): CottiPlatformAuditRiskAnalysis => {
  const jsonText = content
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/\s*```$/, '');
  const parsed = safeParseJSON<Partial<CottiPlatformAuditRiskAnalysis>>(jsonText);
  if (!parsed) throw new Error('模型返回内容不是合法 JSON');

  return {
    confidence:
      parsed.confidence === 'high' || parsed.confidence === 'medium' ? parsed.confidence : 'low',
    error: null,
    evidence: Array.isArray(parsed.evidence) ? parsed.evidence.slice(0, 5) : [],
    model,
    provider,
    reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 1000) : null,
    riskLabels: Array.isArray(parsed.riskLabels) ? parsed.riskLabels.slice(0, 8) : [],
    riskLevel: normalizeCottiPlatformAuditRiskLevel(parsed.riskLevel),
    status: 'completed',
    summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 500) : null,
  };
};
