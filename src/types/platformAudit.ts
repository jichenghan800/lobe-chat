export type PlatformAuditFeatureType = 'agent' | 'chat' | 'error' | 'search' | 'tool';
export type PlatformAuditRange = 1 | 7 | 30 | 90;
export type PlatformAuditRiskLevel = 'high' | 'low' | 'medium' | 'none';

export interface PlatformAuditQuery {
  email?: string;
  feature?: PlatformAuditFeatureType | 'all';
  range?: PlatformAuditRange;
  riskLevel?: PlatformAuditRiskLevel | 'all';
}

export interface PlatformAuditRiskFlag {
  key: string;
  label: string;
  level: Exclude<PlatformAuditRiskLevel, 'none'>;
}

export interface PlatformAuditItem {
  agentId?: null | string;
  contentPreview?: null | string;
  createdAt: string;
  error: boolean;
  fileCount: number;
  id: string;
  model?: null | string;
  provider?: null | string;
  riskFlags: PlatformAuditRiskFlag[];
  riskLevel: PlatformAuditRiskLevel;
  role: string;
  search: boolean;
  sessionId?: null | string;
  sessionTitle?: null | string;
  tool: boolean;
  userEmail?: null | string;
  userId: string;
}

export interface PlatformAuditDetail extends PlatformAuditItem {
  content?: null | string;
}

export interface PlatformAuditDashboard {
  items: PlatformAuditItem[];
  overview: {
    agentMessages: number;
    errorMessages: number;
    highRiskMessages: number;
    searchMessages: number;
    toolMessages: number;
    totalMessages: number;
  };
  query: Required<Pick<PlatformAuditQuery, 'feature' | 'range' | 'riskLevel'>> &
    Pick<PlatformAuditQuery, 'email'>;
}
