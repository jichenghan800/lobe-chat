import type {
  CottiAgentAccessMode,
  CottiAgentAccessRuleItem,
  CottiAgentAccessRuleType,
} from '@/database/schemas';

export type AgentAccessMode = CottiAgentAccessMode;
export type AgentAccessRuleType = CottiAgentAccessRuleType;
export type AgentAccessSource = 'database' | 'environment';

export interface AgentAccessDetail {
  mode: AgentAccessMode;
  rules: CottiAgentAccessRuleItem[];
  source: AgentAccessSource;
}

export interface AgentAccessUserSuggestion {
  email: null | string;
  fullName: null | string;
  id: string;
  normalizedEmail: null | string;
  role: null | string;
  username: null | string;
}
