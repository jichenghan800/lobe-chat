export type CottiPlatformAuditFeature = 'agent' | 'chat' | 'search' | 'task' | 'tool';
export type CottiPlatformAuditMode = 'agent' | 'chat' | 'task';
export type CottiPlatformAuditRange = 1 | 7 | 30 | 90;
export type CottiPlatformAuditRiskFilter = 'all' | 'flagged' | CottiPlatformAuditRiskLevel;
export type CottiPlatformAuditRiskLevel = 'high' | 'low' | 'medium' | 'none';

export interface CottiPlatformAuditQuery {
  feature?: 'all' | CottiPlatformAuditFeature;
  page?: number;
  pageSize?: 20 | 50;
  q?: string;
  range?: CottiPlatformAuditRange;
  riskLevel?: CottiPlatformAuditRiskFilter;
}

export interface CottiPlatformAuditRiskFlag {
  key: string;
  label: string;
  level: Exclude<CottiPlatformAuditRiskLevel, 'none'>;
}

export type CottiPlatformAuditRiskAnalysisStatus = 'completed' | 'failed' | 'pending' | 'running';

export interface CottiPlatformAuditRiskEvidence {
  label: string;
  quote: string;
}

export interface CottiPlatformAuditRiskAnalysis {
  confidence?: 'high' | 'low' | 'medium' | null;
  error?: null | string;
  evidence: CottiPlatformAuditRiskEvidence[];
  model?: null | string;
  provider?: null | string;
  reason?: null | string;
  riskLabels: string[];
  riskLevel?: CottiPlatformAuditRiskLevel | null;
  status: CottiPlatformAuditRiskAnalysisStatus;
  summary?: null | string;
  updatedAt?: null | string;
}

export interface CottiPlatformAuditAttachment {
  documentId?: null | string;
  documentTitle?: null | string;
  extractedTextPreview?: null | string;
  fileType: string;
  id: string;
  name: string;
  size: number;
}

export interface CottiPlatformAuditItem {
  agentId?: null | string;
  analysis?: CottiPlatformAuditRiskAnalysis | null;
  createdAt: string;
  fileCount: number;
  id: string;
  mode: CottiPlatformAuditMode;
  model?: null | string;
  provider?: null | string;
  riskFlags: CottiPlatformAuditRiskFlag[];
  riskLevel: CottiPlatformAuditRiskLevel;
  search: boolean;
  sessionId?: null | string;
  sessionTitle?: null | string;
  tool: boolean;
  userEmail?: null | string;
  userId: string;
  userName?: null | string;
}

export interface CottiPlatformAuditDetail extends CottiPlatformAuditItem {
  attachments: CottiPlatformAuditAttachment[];
  content?: null | string;
  contentPreview?: null | string;
}

export interface CottiPlatformAuditDashboard {
  items: CottiPlatformAuditItem[];
  overview: {
    agentMessages: number;
    attachmentMessages: number;
    chatMessages: number;
    highRiskMessages: number;
    searchMessages: number;
    taskMessages: number;
    toolMessages: number;
    totalMessages: number;
  };
  page: number;
  pageSize: 20 | 50;
  query: Required<
    Pick<CottiPlatformAuditQuery, 'feature' | 'page' | 'pageSize' | 'range' | 'riskLevel'>
  > &
    Pick<CottiPlatformAuditQuery, 'q'>;
  total: number;
}
