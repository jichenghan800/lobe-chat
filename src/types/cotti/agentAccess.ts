export type CottiAgentAccessMode = 'allowlist' | 'off' | 'open';
export type CottiAgentAccessRuleType = 'email' | 'userId';
export type CottiAgentAccessSource = 'database' | 'environment';

export interface CottiAgentAccessRule {
  createdAt: Date | string;
  createdBy: null | string;
  enabled: boolean;
  id: string;
  note: null | string;
  type: CottiAgentAccessRuleType;
  updatedAt: Date | string;
  user: CottiAgentAccessUserSuggestion | null;
  value: string;
}

export interface CottiAgentAccessDetail {
  mode: CottiAgentAccessMode;
  rules: CottiAgentAccessRule[];
  source: CottiAgentAccessSource;
}

export interface CottiAgentAccessUserSuggestion {
  email: null | string;
  fullName: null | string;
  id: string;
  normalizedEmail: null | string;
  role: null | string;
  username: null | string;
}
