export type CottiPlatformAuditFeature = 'agent' | 'chat' | 'search' | 'tool';
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

export interface CottiPlatformAuditItem {
  agentId?: null | string;
  analysis?: CottiPlatformAuditRiskAnalysis | null;
  createdAt: string;
  fileCount: number;
  id: string;
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
  content?: null | string;
  contentPreview?: null | string;
}

export interface CottiPlatformAuditDashboard {
  items: CottiPlatformAuditItem[];
  overview: {
    agentMessages: number;
    attachmentMessages: number;
    highRiskMessages: number;
    searchMessages: number;
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
